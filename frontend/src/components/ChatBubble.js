import React from 'react';
import CryptoJS from 'crypto-js';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
}

function ChatBubble({ message, sentByMe, timestamp, encrypted, senderName, status, avatar, isLastSentByMe, seenBy, image, showStatus, statusToShow, sharedPassword, localPlaintext }) {
  // Instagram-like gradient for sent messages
  const sentGradient = 'bg-gradient-to-br from-blue-700 via-indigo-800 to-blue-900/80';
  const receivedBg = 'bg-[#232136]/80 backdrop-blur-md';
  const textColor = 'text-white';
  const ringColor = sentByMe ? 'ring-2 ring-purple-400' : 'ring-2 ring-blue-400';
  const [revealed, setRevealed] = React.useState(false);
  const [decodeError, setDecodeError] = React.useState('');

  // Detect base64 string if encrypted prop is missing
  const isBase64 = (str) => {
    try {
      return btoa(atob(str)) === str;
    } catch (err) {
      return false;
    }
  };
  const actuallyEncrypted = encrypted || isBase64(message);
  let displayMessage = message;
  let showLock = false;
  if (sentByMe && encrypted) {
    displayMessage = localPlaintext || message;
    showLock = true;
  } else if (encrypted && revealed) {
    try {
      if (!sharedPassword) throw new Error('No shared password set');
      const bytes = CryptoJS.AES.decrypt(message, sharedPassword);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) throw new Error('Decryption failed');
      displayMessage = decrypted;
      showLock = true;
    } catch (e) {
      displayMessage = '[Decryption failed: Incorrect password or corrupted message]';
      showLock = true;
    }
  } else if (encrypted && !revealed && !sentByMe) {
    displayMessage = '••••••••••••••••••••••••';
    showLock = true;
  } else if (encrypted && !revealed && sentByMe) {
    displayMessage = localPlaintext || message;
    showLock = true;
  }

  // Debug logging
  console.log('ChatBubble:', { message, encrypted, actuallyEncrypted });

  // For decode: use per-sender password logic
  const handleDecode = () => {
    if (!sharedPassword) {
      alert('Set the shared password for this chat to decode messages.');
      return;
    }
    try {
      const bytes = CryptoJS.AES.decrypt(message, sharedPassword);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) throw new Error('Decryption failed');
      setRevealed(true);
      setDecodeError('');
    } catch {
      setDecodeError('Incorrect password');
    }
  };

  return (
    <div className={`flex flex-col items-end ${sentByMe ? 'justify-end' : 'justify-start'} w-full font-sans`}>
      <div className={`flex items-end ${sentByMe ? 'justify-end' : 'justify-start'} w-full`}>
        <div
          className={`max-w-xs px-5 py-3 rounded-3xl shadow-xl text-[1.08rem] leading-relaxed relative transition-all duration-200 ${
            sentByMe ? sentGradient + ' rounded-br-2xl' : receivedBg + ' rounded-bl-2xl'
          } ${textColor} hover:scale-[1.025] hover:shadow-2xl`}
          style={{ wordBreak: 'break-word', fontFamily: 'inherit', border: sentByMe ? 'none' : '1px solid #39355288', textShadow: '0 1px 4px rgba(0,0,0,0.18)' }}
        >
          {image && typeof image === 'string' && image.startsWith('data:image') && (
            <img
              src={image}
              alt="attachment"
              className="mb-2 rounded-2xl max-w-[220px] max-h-48 object-cover border border-gray-700 shadow-lg"
              style={{ display: 'block' }}
              onError={e => { e.target.style.display = 'none'; }}
            />
          )}
          {displayMessage}
          {/* Lock icon for encrypted messages */}
          {showLock && (
            <span className="text-yellow-400 text-xl ml-2 align-middle" title="Encrypted">🔒</span>
          )}
          {/* Only show decode button for received encrypted messages that are not revealed */}
          {!sentByMe && encrypted && !revealed && (
            <button
              className="mt-2 px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 focus:outline-none"
              onClick={handleDecode}
            >Decode</button>
          )}
          {decodeError && (
            <div className="text-xs text-red-400 mt-1">{decodeError}</div>
          )}
          <div className="flex items-center justify-end text-[11px] text-gray-400 mt-2 gap-1 font-mono">
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
      {/* Seen/Delivered indicator below the respective message bubble */}
      {sentByMe && showStatus && (
        <div className="text-xs text-right mt-1 pr-2 text-gray-500 font-mono">
          {statusToShow}
        </div>
      )}
    </div>
  );
}

export default ChatBubble; 