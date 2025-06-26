import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: ['https://ajtrix.vercel.app/']
}));
app.use(express.json());

const PORT = process.env.PORT || 4000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

function saveToFile(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function loadFromFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Load users and messages from disk
let users = loadFromFile(USERS_FILE, {});
let contacts = {};
let messages = loadFromFile(MESSAGES_FILE, {});
// Rebuild contacts from users
Object.keys(users).forEach(phone => { contacts[phone] = new Set(users[phone].contacts || []); });

// Save users and messages on change
function persistUsers() {
  // Save contacts as array in users
  Object.keys(users).forEach(phone => { users[phone].contacts = Array.from(contacts[phone] || []); });
  saveToFile(USERS_FILE, users);
}
function persistMessages() {
  saveToFile(MESSAGES_FILE, messages);
}

// In-memory users and contacts
// users: { phone: { phone, username, password } }
const onlineUsers = new Set();
const peeking = {}; // { userPhone: withUserPhone }

function getRoomId(userA, userB) {
  return [userA, userB].sort().join('_');
}

function emitPeekers(userA, userB) {
  // Find who is peeking at this chat
  const peekers = [];
  if (peeking[userA] === userB) peekers.push(userA);
  if (peeking[userB] === userA) peekers.push(userB);
  io.to(userA).emit('chat:peekers', { withUser: userB, peekers });
  io.to(userB).emit('chat:peekers', { withUser: userA, peekers });
}

// Signup endpoint
app.post('/signup', (req, res) => {
  const { phone, username, password } = req.body;
  if (!phone || !username || !password) {
    return res.status(400).json({ success: false, message: 'All fields required' });
  }
  if (users[phone]) {
    return res.status(409).json({ success: false, message: 'Phone number already registered' });
  }
  users[phone] = { phone, username, password, contacts: [] };
  contacts[phone] = new Set();
  persistUsers();
  res.json({ success: true, user: { phone, username } });
});

// Login endpoint
app.post('/login', (req, res) => {
  const { phone, password } = req.body;
  const user = users[phone];
  if (user && user.password === password) {
    res.json({ success: true, user: { phone, username: user.username } });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Add contact by phone number
app.post('/add-contact', (req, res) => {
  const { userPhone, contactPhone } = req.body;
  if (!users[contactPhone]) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (!contacts[userPhone]) contacts[userPhone] = new Set();
  contacts[userPhone].add(contactPhone);
  persistUsers();
  res.json({ success: true, contact: { phone: contactPhone, username: users[contactPhone].username } });
});

// Get contacts for a user
app.get('/users', (req, res) => {
  const userPhone = req.query.userPhone;
  if (!userPhone || !contacts[userPhone]) return res.json([]);
  const contactPhones = Array.from(contacts[userPhone]);
  const contactList = contactPhones.map(phone => ({
    phone,
    username: users[phone]?.username || 'Unknown',
    profilePic: users[phone]?.profilePic || ''
  }));
  res.json(contactList);
});

io.on('connection', (socket) => {
  let userPhone = null;
  let username = null;

  socket.on('login', ({ phone, username: uname }) => {
    userPhone = phone;
    username = uname;
    socket.join(userPhone);
    onlineUsers.add(userPhone);
    io.emit('onlineUsers', Array.from(onlineUsers));
  });

  socket.on('chat:peek', ({ withUser }) => {
    if (!userPhone) return;
    peeking[userPhone] = withUser;
    emitPeekers(userPhone, withUser);
  });

  socket.on('chat:unpeek', ({ withUser }) => {
    if (!userPhone) return;
    if (peeking[userPhone] === withUser) {
      delete peeking[userPhone];
      emitPeekers(userPhone, withUser);
    }
  });

  socket.on('sendMessage', ({ from, to, text, encrypted, image }) => {
    const roomId = getRoomId(from, to);
    const msg = { from, to, text, encrypted, image, timestamp: Date.now(), status: 'sent' };
    if (!messages[roomId]) messages[roomId] = [];
    messages[roomId].push(msg);
    persistMessages();
    // If recipient is peeking at this chat, mark as seen immediately
    if (onlineUsers.has(to) && peeking[to] === from) {
      msg.status = 'seen';
      io.to(from).emit('receiveMessage', { ...msg });
      io.to(to).emit('receiveMessage', { ...msg });
      io.to(from).emit('messageSeen', { ...msg });
    } else {
      // Emit to sender (always delivered)
      io.to(from).emit('receiveMessage', { ...msg, status: onlineUsers.has(to) ? 'delivered' : 'sent' });
      // Emit to recipient (delivered if online)
      if (onlineUsers.has(to)) {
        msg.status = 'delivered';
        io.to(to).emit('receiveMessage', { ...msg });
      }
    }
  });

  socket.on('getHistory', ({ withUser }) => {
    if (!userPhone) return;
    const roomId = getRoomId(userPhone, withUser);
    let seenMsgs = [];
    if (messages[roomId]) {
      messages[roomId].forEach((msg) => {
        if (msg.to === userPhone && msg.from === withUser && msg.status !== 'seen') {
          msg.status = 'seen';
          seenMsgs.push(msg);
        }
      });
    }
    socket.emit('chatHistory', messages[roomId] || []);
    // Notify sender about newly seen messages
    seenMsgs.forEach((msg) => {
      io.to(withUser).emit('messageSeen', { ...msg });
    });
  });

  socket.on('disconnect', () => {
    if (userPhone) {
      onlineUsers.delete(userPhone);
      // Remove peeking status and notify all affected
      if (peeking[userPhone]) {
        emitPeekers(userPhone, peeking[userPhone]);
        delete peeking[userPhone];
      }
      // Also, for all users who were being peeked at by this user, update their peekers
      Object.entries(peeking).forEach(([otherUser, peekedAt]) => {
        if (peekedAt === userPhone) {
          emitPeekers(otherUser, userPhone);
        }
      });
      io.emit('onlineUsers', Array.from(onlineUsers));
    }
  });

  // Poll message status for real-time seen/delivered updates
  socket.on('chat:pollStatus', ({ from, to }) => {
    const roomId = getRoomId(from, to);
    if (!messages[roomId]) return;
    // If recipient is peeking at this chat, mark all delivered messages as seen
    if (peeking[to] === from) {
      messages[roomId].forEach((msg) => {
        if (msg.from === from && msg.to === to && msg.status === 'delivered') {
          msg.status = 'seen';
          io.to(from).emit('messageSeen', { ...msg });
        }
      });
      persistMessages();
    }
  });
});

app.get('/', (req, res) => {
  res.send('Chatter backend is running.');
});

// Add admin user
if (!users['9999999999']) {
  users['9999999999'] = { phone: '9999999999', username: 'admin', password: 'admin123', isAdmin: true, contacts: [] };
  contacts['9999999999'] = new Set();
  persistUsers();
}

// Admin endpoints
app.get('/admin/users', (req, res) => {
  const { phone, password } = req.query;
  const user = users[phone];
  if (!user || !user.isAdmin || user.password !== password) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  res.json(Object.values(users).map(u => ({ phone: u.phone, username: u.username })));
});

app.get('/admin/chats', (req, res) => {
  const { phone, password } = req.query;
  const user = users[phone];
  if (!user || !user.isAdmin || user.password !== password) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  // Return all chat rooms and their messages
  res.json(messages);
});

// Admin: Delete user
app.post('/admin/delete-user', (req, res) => {
  const { phone, password, targetPhone } = req.body;
  const user = users[phone];
  if (!user || !user.isAdmin || user.password !== password) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  if (targetPhone === '9999999999') {
    return res.status(400).json({ success: false, message: 'Cannot delete admin' });
  }
  if (!users[targetPhone]) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  delete users[targetPhone];
  delete contacts[targetPhone];
  // Remove from other users' contacts
  Object.values(contacts).forEach(set => set.delete(targetPhone));
  persistUsers();
  res.json({ success: true });
});

// Admin: Search chats
app.get('/admin/search-chats', (req, res) => {
  const { phone, password, query } = req.query;
  const user = users[phone];
  if (!user || !user.isAdmin || user.password !== password) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  if (!query) return res.json([]);
  const results = [];
  for (const [roomId, msgs] of Object.entries(messages)) {
    for (const msg of msgs) {
      if (msg.text && msg.text.toLowerCase().includes(query.toLowerCase())) {
        results.push({ roomId, ...msg });
      }
    }
  }
  res.json(results);
});

// Update profile photo endpoint
app.post('/update-profile-photo', (req, res) => {
  const { phone, profilePic } = req.body;
  if (!phone || !users[phone]) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  users[phone].profilePic = profilePic;
  persistUsers();
  io.emit('profilePicUpdated', { phone, profilePic });
  res.json({ success: true, user: { phone, username: users[phone].username, profilePic } });
});

// Update username endpoint
app.post('/update-username', (req, res) => {
  const { phone, username } = req.body;
  if (!phone || !users[phone]) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  users[phone].username = username;
  persistUsers();
  res.json({ success: true, user: { phone, username, profilePic: users[phone].profilePic || '' } });
});

server.listen(PORT, '0.0.0.0'); 