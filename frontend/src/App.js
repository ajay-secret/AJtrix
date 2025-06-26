import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import ChatHeader from './components/ChatHeader';
import ChatBubble from './components/ChatBubble';
import ChatInput from './components/ChatInput';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://192.168.0.105:4000';

function App() {
  const [user, setUser] = useState(null); // { phone, username }
  const [users, setUsers] = useState([]); // contacts
  const [selectedUser, setSelectedUser] = useState(null); // user to chat with
  const [messages, setMessages] = useState([]); // current chat messages
  const socketRef = useRef(null);

  // Login/Signup form state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showSignup, setShowSignup] = useState(false);
  const [signupPhone, setSignupPhone] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupError, setSignupError] = useState('');

  // Add Contact state
  const [showAddContact, setShowAddContact] = useState(false);
  const [addContactPhone, setAddContactPhone] = useState('');
  const [addContactError, setAddContactError] = useState('');

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminChats, setAdminChats] = useState({});
  const [adminSelectedRoom, setAdminSelectedRoom] = useState(null);
  const [impersonatedUser, setImpersonatedUser] = useState(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminSearchResults, setAdminSearchResults] = useState([]);
  const [adminError, setAdminError] = useState('');

  // Online users state
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Profile tab state
  const [showProfile, setShowProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Peeking state
  const [peekers, setPeekers] = useState([]);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Add password state
  const [encryptionPassword, setEncryptionPassword] = useState(() => localStorage.getItem('encryptionPassword') || '');
  // Add per-sender decode password map (in-memory only)
  const [decodePasswords, setDecodePasswords] = useState({});

  // Shared password per chat (by contact phone)
  const [sharedPasswords, setSharedPasswords] = useState(() => {
    // Load from localStorage if available
    try {
      return JSON.parse(localStorage.getItem('sharedPasswords') || '{}');
    } catch {
      return {};
    }
  });

  // Add state to store the Y position of the clicked contact
  const [chatOriginY, setChatOriginY] = useState(0);

  // Add state for chat overlay animation
  const [chatOverlayClosing, setChatOverlayClosing] = useState(false);

  // Add state for options modal
  const [showOptions, setShowOptions] = useState(false);

  // Add state for editable profile
  const [editUsername, setEditUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [profilePic, setProfilePic] = useState('');

  // Add state for profile pic menu
  const [showProfilePicMenu, setShowProfilePicMenu] = useState(false);
  const fileInputRef = useRef();

  // Clear decode passwords when chat changes
  React.useEffect(() => {
    setDecodePasswords({});
  }, [selectedUser]);

  // Connect socket after login
  useEffect(() => {
    if (!user) return;
    const socket = io(BACKEND_URL);
    socketRef.current = socket;
    socket.emit('login', { phone: user.phone, username: user.username });
    socket.on('receiveMessage', (msg) => {
      if (
        (msg.from === user.phone && msg.to === selectedUser?.phone) ||
        (msg.from === selectedUser?.phone && msg.to === user.phone)
      ) {
        setMessages((prev) => [...prev, msg]);
      }
    });
    return () => socket.disconnect();
    // eslint-disable-next-line
  }, [user, selectedUser]);

  // Fetch contacts after login
  useEffect(() => {
    if (!user) return;
    fetch(`${BACKEND_URL}/users?userPhone=${user.phone}`)
      .then((res) => res.json())
      .then((data) => setUsers(data));
  }, [user]);

  // Fetch chat history when selectedUser changes
  useEffect(() => {
    if (!user || !selectedUser || !socketRef.current) return;
    setMessages([]);
    socketRef.current.emit('getHistory', { withUser: selectedUser.phone });
    socketRef.current.on('chatHistory', (msgs) => setMessages(msgs));
    return () => socketRef.current?.off('chatHistory');
  }, [user, selectedUser]);

  // Detect admin after login
  useEffect(() => {
    if (user && user.phone === '9999999999') {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  // Fetch admin data
  useEffect(() => {
    if (!isAdmin) return;
    // Fetch all users
    fetch(`${BACKEND_URL}/admin/users?phone=${user.phone}&password=admin123`)
      .then((res) => res.json())
      .then((data) => setAdminUsers(data));
    // Fetch all chats
    fetch(`${BACKEND_URL}/admin/chats?phone=${user.phone}&password=admin123`)
      .then((res) => res.json())
      .then((data) => setAdminChats(data));
  }, [isAdmin, user]);

  // Listen for messageSeen events
  useEffect(() => {
    if (!user || !socketRef.current) return;
    const socket = socketRef.current;
    socket.on('messageSeen', (seenMsg) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.timestamp === seenMsg.timestamp && msg.from === seenMsg.from && msg.to === seenMsg.to
            ? { ...msg, status: 'seen' }
            : msg
        )
      );
    });
    return () => socket.off('messageSeen');
  }, [user]);

  // Listen for onlineUsers event
  useEffect(() => {
    if (!user || !socketRef.current) return;
    const socket = socketRef.current;
    socket.on('onlineUsers', setOnlineUsers);
    return () => socket.off('onlineUsers');
  }, [user]);

  // Emit chat:peek when opening a chat, chat:unpeek when leaving
  useEffect(() => {
    if (!user || !selectedUser || !socketRef.current) return;
    const socket = socketRef.current;
    socket.emit('chat:peek', { withUser: selectedUser.phone });
    return () => {
      socket.emit('chat:unpeek', { withUser: selectedUser.phone });
    };
  }, [user, selectedUser]);

  // Persistent chat:peekers listener
  useEffect(() => {
    if (!user || !socketRef.current) return;
    const socket = socketRef.current;
    const handler = ({ withUser, peekers }) => {
      // Only update if this is the current chat
      if (selectedUser && withUser === selectedUser.phone) {
        setPeekers(peekers);
      }
    };
    socket.on('chat:peekers', handler);
    return () => socket.off('chat:peekers', handler);
  }, [user, socketRef, selectedUser]);

  // Poll peeking status every second while in chat
  useEffect(() => {
    if (!user || !selectedUser || !socketRef.current) return;
    const socket = socketRef.current;
    const interval = setInterval(() => {
      socket.emit('chat:peek', { withUser: selectedUser.phone });
      // Poll message status for real-time seen/delivered
      socket.emit('chat:pollStatus', { from: user.phone, to: selectedUser.phone });
    }, 1000);
    return () => clearInterval(interval);
  }, [user, selectedUser]);

  // Auto-scroll to bottom when messages change or chat is opened
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedUser]);

  // Listen for profilePicUpdated events and update users/selectedUser in real time
  useEffect(() => {
    if (!user || !socketRef.current) return;
    const socket = socketRef.current;
    const handler = ({ phone, profilePic }) => {
      setUsers(prev => prev.map(u => u.phone === phone ? { ...u, profilePic } : u));
      setSelectedUser(prev => {
        if (prev && prev.phone === phone) {
          // Find the latest user object from users (with all fields)
          const updated = users.find(u => u.phone === phone);
          return updated ? { ...updated, profilePic } : { ...prev, profilePic };
        }
        return prev;
      });
    };
    socket.on('profilePicUpdated', handler);
    return () => socket.off('profilePicUpdated', handler);
  }, [user, users]);

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${BACKEND_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone, password: loginPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
      } else {
        setLoginError(data.message || 'Login failed');
      }
    } catch (err) {
      setLoginError('Network error');
    }
  };

  // Handle signup
  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupError('');
    try {
      const res = await fetch(`${BACKEND_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: signupPhone, username: signupUsername, password: signupPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user); // auto-login after signup
      } else {
        setSignupError(data.message || 'Signup failed');
      }
    } catch (err) {
      setSignupError('Network error');
    }
  };

  // Handle send message
  const handleSend = (msg, encrypt, image, localPlaintext) => {
    if (!user || !selectedUser) return;
    socketRef.current.emit('sendMessage', {
      from: user.phone,
      to: selectedUser.phone,
      text: msg,
      encrypted: encrypt,
      image,
    });
  };

  // Add contact handler
  const handleAddContact = async (e) => {
    e.preventDefault();
    setAddContactError('');
    if (!addContactPhone) return setAddContactError('Enter a phone number');
    try {
      const res = await fetch(`${BACKEND_URL}/add-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPhone: user.phone, contactPhone: addContactPhone }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) => [...prev, data.contact]);
        setShowAddContact(false);
        setAddContactPhone('');
      } else {
        setAddContactError(data.message || 'Could not add contact');
      }
    } catch (err) {
      setAddContactError('Network error');
    }
  };

  // Impersonate user
  const handleImpersonate = (u) => {
    setImpersonatedUser(u);
    setUser(u);
    setIsAdmin(false);
  };

  // Return to admin
  const handleReturnToAdmin = () => {
    setImpersonatedUser(null);
    setUser({ phone: '9999999999', username: 'admin' });
    setIsAdmin(true);
  };

  // Delete user
  const handleDeleteUser = async (u) => {
    if (!window.confirm(`Delete user ${u.username} (${u.phone})?`)) return;
    setAdminError('');
    try {
      const res = await fetch(`${BACKEND_URL}/admin/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '9999999999', password: 'admin123', targetPhone: u.phone }),
      });
      const data = await res.json();
      if (data.success) {
        setAdminUsers((prev) => prev.filter((user) => user.phone !== u.phone));
        setAdminChats((prev) => {
          const copy = { ...prev };
          Object.keys(copy).forEach((roomId) => {
            if (roomId.includes(u.phone)) delete copy[roomId];
          });
          return copy;
        });
      } else {
        setAdminError(data.message || 'Delete failed');
      }
    } catch (err) {
      setAdminError('Network error');
    }
  };

  // Search chats
  const handleAdminSearch = async (e) => {
    e.preventDefault();
    setAdminError('');
    setAdminSearchResults([]);
    if (!adminSearch.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/admin/search-chats?phone=9999999999&password=admin123&query=${encodeURIComponent(adminSearch)}`);
      const data = await res.json();
      setAdminSearchResults(data);
    } catch (err) {
      setAdminError('Network error');
    }
  };

  // Profile tab state
  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This cannot be undone.')) return;
    setProfileError('');
    try {
      const res = await fetch(`${BACKEND_URL}/admin/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '9999999999', password: 'admin123', targetPhone: user.phone }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(null);
        setShowProfile(false);
      } else {
        setProfileError(data.message || 'Delete failed');
      }
    } catch (err) {
      setProfileError('Network error');
    }
  };

  // Helper to set password
  const handleSetEncryptionPassword = (pw) => {
    setEncryptionPassword(pw);
    if (pw) localStorage.setItem('encryptionPassword', pw);
    else localStorage.removeItem('encryptionPassword');
  };

  // Helper to set shared password for a contact
  const handleSetSharedPassword = (contactPhone, pw) => {
    setSharedPasswords((prev) => {
      const updated = { ...prev, [contactPhone]: pw };
      localStorage.setItem('sharedPasswords', JSON.stringify(updated));
      return updated;
    });
  };

  // Helper to close chat with animation
  const closeChatOverlay = () => {
    setChatOverlayClosing(true);
    setTimeout(() => {
      setSelectedUser(null);
      setChatOverlayClosing(false);
    }, 600); // match .chat-bounce-out duration
  };

  // Update username in state and localStorage
  const handleSaveUsername = () => {
    setUser(u => ({ ...u, username: newUsername }));
    setEditUsername(false);
    localStorage.setItem('username', newUsername);
  };

  // Helper to resize image before upload
  function resizeImage(file, maxSize = 256, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height;
              height = maxSize;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Update profile picture in state and localStorage
  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      resizeImage(file, 256, 0.7).then((resizedDataUrl) => {
        setProfilePic(resizedDataUrl);
        fetch(`${BACKEND_URL}/update-profile-photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: user.phone, profilePic: resizedDataUrl }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setProfilePic(data.user.profilePic || '');
              setUser(u => ({ ...u, profilePic: data.user.profilePic || '' }));
            }
          });
      });
    }
  };

  // UI: User list (always rendered as background)
  const contactsPage = (
    <div className="flex flex-col h-screen bg-[#18122B]">
      {/* WhatsApp-style header */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#232136] shadow-lg border-b border-[#393552]/60">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-extrabold text-yellow-400 ajtrix-font">AJtrix</span>
        </div>
        {/* Options icon */}
        <div className="relative">
          <button
            className="text-yellow-400 hover:text-white text-3xl p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transform hover:scale-110 transition-transform duration-200"
            onClick={() => setShowOptions(true)}
            title="Options"
          >
            ⋮
          </button>
          {/* Options Modal/Dropdown */}
          {showOptions && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
              onClick={() => setShowOptions(false)}
            >
              <div
                className="bg-[#232136] rounded-2xl shadow-2xl border border-[#393552]/60 p-8 w-80 max-w-full flex flex-col items-center relative"
                onClick={e => e.stopPropagation()}
              >
                {/* Profile details */}
                <div className="relative mb-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-yellow-400 flex items-center justify-center text-white font-bold text-3xl shadow-lg overflow-hidden">
                    {profilePic ? (
                      <img src={profilePic} alt="avatar" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      user.username ? user.username[0].toUpperCase() : '?'
                    )}
                  </div>
                  {/* Edit avatar icon */}
                  <label className="absolute bottom-0 right-0 bg-[#232136] border border-[#393552]/60 rounded-full p-1 cursor-pointer shadow-lg" style={{transform: 'translate(35%, 35%)'}} title="Change profile picture">
                    <button type="button" onClick={() => setShowProfilePicMenu(v => !v)} className="text-lg">📷</button>
                    {showProfilePicMenu && (
                      <div className="absolute z-10 right-0 bottom-10 bg-[#232136] border border-[#393552]/60 rounded-xl shadow-lg flex flex-col min-w-[140px]">
                        <button
                          className="px-4 py-2 hover:bg-[#393552]/60 text-white text-left rounded-t-xl"
                          onClick={() => { setShowProfilePicMenu(false); fileInputRef.current.click(); }}
                        >Upload New Photo</button>
                        <button
                          className="px-4 py-2 hover:bg-[#393552]/60 text-red-400 text-left rounded-b-xl"
                          onClick={() => { setShowProfilePicMenu(false); setProfilePic(''); fetch(`${BACKEND_URL}/update-profile-photo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: user.phone, profilePic: '' }) }).then(res => res.json()).then(data => { if (data.success) { setUser(u => ({ ...u, profilePic: '' })); } }); }}
                        >Remove Photo</button>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleProfilePicChange} />
                  </label>
                </div>
                {/* Username edit */}
                <div className="relative mb-2 w-full flex flex-col items-center">
                  {editUsername ? (
                    <div className="flex items-center gap-2 w-full justify-center">
                      <input
                        className="bg-[#18122B] border border-[#393552] rounded px-2 py-1 text-white text-lg focus:ring-2 focus:ring-yellow-400 w-full max-w-[180px]"
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveUsername(); }}
                      />
                      <button className="text-green-400 text-lg font-bold" onClick={handleSaveUsername} title="Save username">✔️</button>
                      <button className="text-red-400 text-lg font-bold" onClick={() => { setEditUsername(false); setNewUsername(user.username); }} title="Cancel">✖️</button>
                    </div>
                  ) : (
                    <div className="relative w-full flex justify-center">
                      <div className="font-bold text-2xl text-white w-full text-center">{user.username}</div>
                      <button
                        className="absolute right-0 top-1/2 -translate-y-1/2 text-yellow-400 text-lg p-1"
                        style={{transform: 'translateY(-50%)'}} 
                        onClick={() => setEditUsername(true)}
                        title="Edit username"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-gray-400 mb-6">{user.phone}</div>
                {/* Logout button */}
                <button
                  className="w-full bg-gradient-to-tr from-red-500 via-pink-500 to-yellow-400 text-white py-3 rounded-xl font-bold text-lg shadow-lg hover:scale-105 transition-transform duration-200 mt-4"
                  onClick={() => { setShowOptions(false); setUser(null); }}
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Contact list */}
      <div className="flex-1 overflow-y-auto bg-[#18122B] px-0 sm:px-0 py-2 relative">
        <ul className="max-w-xl mx-auto mt-2">
          {users.map((u) => {
            const isOnline = onlineUsers.includes(u.phone);
            // Find last message with this contact
            const lastMsg = messages.filter(m => (m.from === u.phone || m.to === u.phone)).slice(-1)[0];
            let lastMsgText = lastMsg ? (lastMsg.text && lastMsg.encrypted ? '' : lastMsg.text) : '';
            return (
              <li key={u.phone} className="mb-2">
                <button
                  className="flex items-center gap-4 w-full text-left px-5 py-4 rounded-2xl bg-[#232136] hover:bg-[#2a1e4d] shadow transition-all duration-150 border border-[#393552]/60 transform hover:scale-105 transition-transform duration-200"
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setChatOriginY(rect.top + rect.height / 2 - window.innerHeight / 2);
                    setSelectedUser(u);
                  }}
                >
                  <span className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl relative bg-gradient-to-tr from-purple-500 via-pink-500 to-yellow-400 text-white shadow-lg ${isOnline ? 'ring-2 ring-green-400' : 'ring-2 ring-gray-700'}`}>
                    {u.profilePic ? (
                      <img src={u.profilePic} alt="avatar" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      u.username ? u.username[0].toUpperCase() : '?'
                    )}
                    {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#232136]"></span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-lg text-white truncate">{u.username}</div>
                    <div className="text-xs text-gray-400 truncate">{u.phone}</div>
                    <div className="text-sm text-gray-300 truncate mt-1">{lastMsgText}</div>
                  </div>
                  {/* Set Shared Password Button at right end */}
                  <button
                    className="ml-2 px-2 py-1 rounded-full bg-[#393552] hover:bg-yellow-500 text-yellow-400 hover:text-white transition-colors duration-200 text-lg"
                    title="Set Shared Password for this chat"
                    onClick={e => {
                      e.stopPropagation();
                      const pw = prompt('Set a shared password for this chat:');
                      if (pw !== null && pw !== '') handleSetSharedPassword(u.phone, pw);
                    }}
                    style={{lineHeight: 1}}
                  >
                    <span role="img" aria-label="Set Password">🔒</span>
                  </button>
                </button>
              </li>
            );
          })}
        </ul>
        {/* Floating action button for Add Contact */}
        <button
          className="fixed bottom-8 right-8 bg-gradient-to-tr from-green-400 via-blue-500 to-purple-500 text-white rounded-full shadow-lg p-5 text-3xl hover:scale-110 transition-transform duration-200 z-50"
          style={{boxShadow: '0 4px 24px 0 rgba(80, 60, 120, 0.25)'}}
          onClick={() => setShowAddContact(true)}
          title="Add Contact"
        >
          <span role="img" aria-label="Add Contact">➕</span>
        </button>
      </div>
      {/* Add Contact Modal */}
      {showAddContact && (
        <form className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50" onSubmit={handleAddContact}>
          <div className="bg-[#232136] p-8 rounded-2xl shadow-xl w-80 flex flex-col items-center">
            <div className="mb-4 font-bold text-lg text-white">Add Contact by Phone Number</div>
            <input
              className="w-full mb-4 px-4 py-2 rounded border border-[#393552] bg-[#18122B] text-white focus:ring-2 focus:ring-yellow-400"
              placeholder="Phone Number"
              value={addContactPhone}
              onChange={(e) => setAddContactPhone(e.target.value)}
              autoFocus
            />
            {addContactError && <div className="text-red-400 mb-2 text-sm">{addContactError}</div>}
            <div className="flex gap-2 w-full">
              <button className="flex-1 bg-gradient-to-tr from-green-400 via-blue-500 to-purple-500 text-white px-4 py-2 rounded-full font-bold" type="submit">Add</button>
              <button className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-full font-bold" type="button" onClick={() => { setShowAddContact(false); setAddContactError(''); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );

  // Floating chat overlay/modal
  const chatOverlay = selectedUser && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget) closeChatOverlay();
      }}
    >
      <div
        className={`relative w-full max-w-2xl h-[98vh] sm:h-[90vh] bg-[#232136]/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-[#393552]/60 flex flex-col ${chatOverlayClosing ? 'chat-bounce-out' : 'chat-bounce-in'}`}
        style={{ '--chat-origin-y': `${chatOriginY}px` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Chat UI */}
        <ChatHeader
          friendName={selectedUser.username}
          online={onlineUsers.includes(selectedUser.phone)}
          avatar={selectedUser.profilePic ? <img src={selectedUser.profilePic} alt="avatar" className="w-full h-full object-cover rounded-full" /> : selectedUser.username?.[0]?.toUpperCase()}
          isFriendPeeking={peekers.includes(selectedUser.phone)}
          onBack={closeChatOverlay}
        />
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4 relative custom-scrollbar touch-pan-y">
          {messages.map((msg, idx) => {
            const sentByMe = msg.from === user.phone;
            let showStatus = false;
            let statusToShow = '';
            if (sentByMe) {
              // Find next sent message
              let nextIdx = idx + 1;
              let nextSentMsg = null;
              while (nextIdx < messages.length) {
                if (messages[nextIdx].from === user.phone) {
                  nextSentMsg = messages[nextIdx];
                  break;
                }
                nextIdx++;
              }
              // If this is the last message sent by me
              if (!nextSentMsg) {
                showStatus = true;
                statusToShow = msg.status === 'seen' ? 'Seen' : msg.status === 'delivered' ? 'Delivered' : 'Sent';
              } else if (msg.status === 'seen' && nextSentMsg.status !== 'seen') {
                showStatus = true;
                statusToShow = 'Seen';
              } else if (msg.status === 'delivered' && nextSentMsg.status !== 'delivered' && nextSentMsg.status !== 'seen') {
                showStatus = true;
                statusToShow = 'Delivered';
              }
            }
            return (
              <ChatBubble
                key={idx}
                message={msg.text}
                sentByMe={sentByMe}
                timestamp={msg.timestamp}
                encrypted={msg.encrypted}
                senderName={sentByMe ? user.username : selectedUser.username}
                avatar={(sentByMe ? user.username : selectedUser.username)?.[0]?.toUpperCase()}
                status={msg.status}
                image={msg.image}
                showStatus={showStatus}
                statusToShow={statusToShow}
                sharedPassword={sharedPasswords[selectedUser.phone] || ''}
                localPlaintext={msg.localPlaintext}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-2 sm:p-4">
          <ChatInput onSend={handleSend} isFriendPeeking={peekers.includes(selectedUser.phone)} sharedPassword={sharedPasswords[selectedUser.phone] || ''} />
        </div>
      </div>
    </div>
  );

  // Render both contacts page and floating chat overlay
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#18122B] via-[#232136] to-[#232136]">
        <form className="bg-[#232136] p-10 rounded-3xl shadow-2xl w-96 max-w-full flex flex-col items-center border border-[#393552]/60" onSubmit={handleLogin}>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">🔐</span>
            <span className="text-3xl font-extrabold text-yellow-400 ajtrix-font">AJtrix</span>
          </div>
          <h2 className="text-xl font-bold mb-4 text-white">Login</h2>
          <input
            className="w-full mb-4 px-4 py-3 rounded-xl border border-[#393552] bg-[#18122B] text-white focus:ring-2 focus:ring-yellow-400"
            placeholder="Phone Number"
            value={loginPhone}
            onChange={(e) => setLoginPhone(e.target.value)}
            autoFocus
          />
          <input
            className="w-full mb-6 px-4 py-3 rounded-xl border border-[#393552] bg-[#18122B] text-white focus:ring-2 focus:ring-yellow-400"
            placeholder="Password"
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
          />
          {loginError && <div className="text-red-400 mb-2 text-sm">{loginError}</div>}
          <button className="w-full bg-gradient-to-tr from-green-400 via-blue-500 to-purple-500 text-white py-3 rounded-xl font-bold text-lg shadow-lg hover:scale-105 transition-transform duration-200" type="submit">Login</button>
          <div className="mt-4 text-sm text-center text-gray-300">
            New user?{' '}
            <button type="button" className="text-yellow-400 underline" onClick={() => setShowSignup(true)}>
              Sign up
            </button>
          </div>
        </form>
      </div>
    );
  }
  if (showSignup) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#18122B] via-[#232136] to-[#232136]">
        <form className="bg-[#232136] p-10 rounded-3xl shadow-2xl w-96 max-w-full flex flex-col items-center border border-[#393552]/60" onSubmit={handleSignup}>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">🔐</span>
            <span className="text-3xl font-extrabold text-yellow-400 ajtrix-font">AJtrix</span>
          </div>
          <h2 className="text-xl font-bold mb-4 text-white">Sign Up</h2>
          <input
            className="w-full mb-3 px-4 py-3 rounded-xl border border-[#393552] bg-[#18122B] text-white focus:ring-2 focus:ring-yellow-400"
            placeholder="Phone Number"
            value={signupPhone}
            onChange={(e) => setSignupPhone(e.target.value)}
            autoFocus
          />
          <input
            className="w-full mb-3 px-4 py-3 rounded-xl border border-[#393552] bg-[#18122B] text-white focus:ring-2 focus:ring-yellow-400"
            placeholder="Username"
            value={signupUsername}
            onChange={(e) => setSignupUsername(e.target.value)}
          />
          <input
            className="w-full mb-4 px-4 py-3 rounded-xl border border-[#393552] bg-[#18122B] text-white focus:ring-2 focus:ring-yellow-400"
            placeholder="Password"
            type="password"
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
          />
          {signupError && <div className="text-red-400 mb-2 text-sm">{signupError}</div>}
          <button className="w-full bg-gradient-to-tr from-green-400 via-blue-500 to-purple-500 text-white py-3 rounded-xl font-bold text-lg shadow-lg hover:scale-105 transition-transform duration-200" type="submit">Sign Up</button>
          <div className="mt-4 text-sm text-center text-gray-300">
            Already have an account?{' '}
            <button type="button" className="text-yellow-400 underline" onClick={() => setShowSignup(false)}>
              Log in
            </button>
          </div>
        </form>
      </div>
    );
  }
  if (isAdmin) {
    return (
      <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
        <div className="p-4 bg-white dark:bg-gray-800 shadow flex items-center justify-between">
          <div className="font-bold text-lg text-gray-900 dark:text-white">Admin Dashboard</div>
          <button className="text-blue-500 underline" onClick={() => setUser(null)}>Logout</button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/3 border-r dark:border-gray-700 overflow-y-auto p-4">
            <h3 className="font-bold mb-2 text-gray-700 dark:text-gray-200">All Users</h3>
            <ul>
              {adminUsers.map((u) => (
                <li key={u.phone} className="mb-2 flex items-center gap-2">
                  <div className="flex-1 font-mono text-sm">{u.username} ({u.phone})</div>
                  {u.phone !== '9999999999' && (
                    <>
                      <button className="text-xs bg-green-500 text-white px-2 py-1 rounded" onClick={() => handleImpersonate(u)}>Impersonate</button>
                      <button className="text-xs bg-red-500 text-white px-2 py-1 rounded" onClick={() => handleDeleteUser(u)}>Delete</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <h3 className="font-bold mt-6 mb-2 text-gray-700 dark:text-gray-200">All Chat Rooms</h3>
            <ul>
              {Object.keys(adminChats).map((roomId) => (
                <li key={roomId}>
                  <button
                    className={`w-full text-left px-2 py-1 rounded ${adminSelectedRoom === roomId ? 'bg-blue-200 dark:bg-blue-900' : 'bg-white dark:bg-gray-700'} mb-1`}
                    onClick={() => setAdminSelectedRoom(roomId)}
                  >
                    {roomId}
                  </button>
                </li>
              ))}
            </ul>
            <form className="mt-6" onSubmit={handleAdminSearch}>
              <input
                className="w-full px-2 py-1 rounded border dark:bg-gray-700 dark:text-white mb-2"
                placeholder="Search all chats..."
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
              />
              <button className="w-full bg-blue-500 text-white py-1 rounded" type="submit">Search</button>
            </form>
            {adminError && <div className="text-red-500 mt-2 text-sm">{adminError}</div>}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="font-bold mb-2 text-gray-700 dark:text-gray-200">Chat History</h3>
            {adminSelectedRoom && adminChats[adminSelectedRoom] ? (
              <div className="space-y-2">
                {adminChats[adminSelectedRoom].map((msg, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-mono text-xs text-gray-500">[{new Date(msg.timestamp).toLocaleString()}]</span>{' '}
                    <span className="font-bold text-blue-700 dark:text-blue-300">{msg.from}</span> → <span className="font-bold text-green-700 dark:text-green-300">{msg.to}</span>: {msg.text}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400">Select a chat room to view messages.</div>
            )}
            {adminSearchResults.length > 0 && (
              <div className="mt-6">
                <h4 className="font-bold mb-2 text-gray-700 dark:text-gray-200">Search Results</h4>
                <div className="space-y-2">
                  {adminSearchResults.map((msg, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-mono text-xs text-gray-500">[{new Date(msg.timestamp).toLocaleString()}]</span>{' '}
                      <span className="font-bold text-blue-700 dark:text-blue-300">{msg.from}</span> → <span className="font-bold text-green-700 dark:text-green-300">{msg.to}</span> <span className="italic">({msg.roomId})</span>: {msg.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  if (impersonatedUser) {
    return (
      <div className="relative">
        <div className="fixed top-0 left-0 right-0 bg-yellow-300 text-black text-center py-2 z-50">
          <span>Impersonating {impersonatedUser.username} ({impersonatedUser.phone})</span>
          <button className="ml-4 bg-blue-500 text-white px-2 py-1 rounded" onClick={handleReturnToAdmin}>Return to Admin</button>
        </div>
        <div className="pt-12">
          {/* Render normal user UI below banner */}
          {/* ...existing user UI code... */}
          {/* The rest of the App.js code will render as normal for the impersonated user */}
        </div>
      </div>
    );
  }
  if (showProfile) {
    return (
      <div className="flex flex-col h-screen bg-[#18122B] text-white">
        <div className="p-4 bg-[#232136] shadow flex items-center justify-between">
          <div className="font-bold text-lg">Profile</div>
          <button className="text-blue-400 underline" onClick={() => setShowProfile(false)}>Back</button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-yellow-400 flex items-center justify-center text-white font-bold text-3xl mb-4">
            {user.username ? user.username[0].toUpperCase() : '?'}
          </div>
          <div className="font-bold text-2xl mb-2">{user.username}</div>
          <div className="text-gray-400 mb-6">{user.phone}</div>
          <button className="bg-red-500 text-white px-6 py-2 rounded-full font-bold" onClick={handleDeleteAccount}>Delete Account</button>
          {/* Encryption password management */}
          <div className="mt-8 w-full max-w-xs">
            <div className="font-bold mb-2">Encryption Password</div>
            {encryptionPassword ? (
              <>
                <div className="mb-2 text-green-400">Password is set</div>
                <button className="bg-yellow-500 text-white px-4 py-2 rounded mr-2" onClick={() => {
                  const pw = prompt('Enter new password:');
                  if (pw !== null && pw !== '') handleSetEncryptionPassword(pw);
                }}>Change Password</button>
                <button className="bg-gray-600 text-white px-4 py-2 rounded" onClick={() => {
                  if (window.confirm('Delete encryption password? All future messages will be sent unencrypted.')) handleSetEncryptionPassword('');
                }}>Delete Password</button>
              </>
            ) : (
              <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={() => {
                const pw = prompt('Set a password for encryption:');
                if (pw !== null && pw !== '') handleSetEncryptionPassword(pw);
              }}>Set Password</button>
            )}
          </div>
          {profileError && <div className="text-red-400 mt-4">{profileError}</div>}
        </div>
      </div>
    );
  }
  // Default: show contacts page and overlay if chat is open
  return (
    <>
      {contactsPage}
      {chatOverlay}
    </>
  );
}

export default App;

/* Add to the bottom of your App.js or in your global CSS */
<style>{`
@keyframes peekInTilt {
  0% { opacity: 0; transform: translateY(100%) rotate(-30deg) scale(0.7); }
  60% { opacity: 1; transform: translateY(-10%) rotate(-5deg) scale(1.1); }
  80% { transform: translateY(0%) rotate(-10deg) scale(0.95); }
  100% { opacity: 1; transform: translateY(30%) rotate(-10deg) scale(1); }
}

.peek-avatar-anim {
  transition: opacity 0.3s, transform 0.3s;
  will-change: opacity, transform;
}
/* Custom pill-shaped scrollbar for chat */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #393552 #232136;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #393552;
  border-radius: 8px;
  min-height: 40px;
  border: 2px solid #232136;
  transition: background 0.2s;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #5a547a;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
`}</style> 