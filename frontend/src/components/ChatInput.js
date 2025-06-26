import React, { useState, useRef } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import CryptoJS from 'crypto-js';

function ChatInput({ onSend, isFriendPeeking, sharedPassword, onSetSharedPassword }) {
  const [message, setMessage] = useState('');
  const [encrypt, setEncrypt] = useState(false);
  const [image, setImage] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef();
  const inputRef = useRef();
  const cursorPosRef = useRef(0);

  const handleLockClick = () => {
    if (!encrypt && !sharedPassword) {
      // Prompt for shared password if not set
      onSetSharedPassword();
      return;
    }
    setEncrypt((e) => !e);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim() && !image) return;
    let msgToSend = message;
    let isEncrypted = false;
    let localPlaintext = message;
    if (encrypt && sharedPassword) {
      // Encrypt with AES using the shared password
      msgToSend = CryptoJS.AES.encrypt(message, sharedPassword).toString();
      isEncrypted = true;
    }
    if (encrypt && !sharedPassword) {
      onSetSharedPassword();
      return;
    }
    if (onSend) onSend(msgToSend, isEncrypted, image, localPlaintext);
    setMessage('');
    setImage(null);
    setShowEmoji(false);
  };

  const handleInputSelect = (e) => {
    cursorPosRef.current = e.target.selectionStart;
  };

  const handleInputFocus = (e) => {
    cursorPosRef.current = e.target.selectionStart;
  };

  const handleInputBlur = (e) => {
    cursorPosRef.current = e.target.selectionStart;
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    cursorPosRef.current = e.target.selectionStart;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setImage(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleEmojiSelect = (emoji) => {
    let cursor = cursorPosRef.current;
    let emojiChar = '';
    if (emoji.native) {
      emojiChar = emoji.native;
    } else if (emoji.unified) {
      emojiChar = String.fromCodePoint(...emoji.unified.split('-').map(u => '0x' + u));
    } else if (emoji.colons) {
      emojiChar = emoji.colons;
    }
    const newMsg = message.slice(0, cursor) + emojiChar + message.slice(cursor);
    setMessage(newMsg);
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = cursor + emojiChar.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPos, newPos);
        cursorPosRef.current = newPos;
      }
    }, 0);
  };

  // Close emoji picker on outside click
  React.useEffect(() => {
    if (!showEmoji) return;
    const handleClick = (e) => {
      if (!e.target.closest('.emoji-mart')) setShowEmoji(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmoji]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <form
        className="flex items-center gap-3 bg-[#232136]/80 backdrop-blur-md rounded-full shadow-2xl px-6 py-3 w-full max-w-2xl mx-auto border border-[#393552]/60"
        style={{ position: 'relative', zIndex: 1, boxShadow: '0 4px 32px 0 rgba(30, 30, 60, 0.25)' }}
        onSubmit={handleSend}
      >
        <button
          type="button"
          className={`mr-1 px-3 py-2 rounded-full text-xl transition-colors duration-200 border-2 ${encrypt ? 'bg-gradient-to-tr from-purple-500 via-pink-500 to-yellow-400 text-white border-yellow-400 shadow-lg' : 'bg-[#232136]/60 text-white border-gray-700'}`}
          onClick={handleLockClick}
          aria-label="Toggle encryption"
        >
          {encrypt ? '🔒' : '🔓'}
        </button>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            className="text-2xl px-3 py-2 rounded-full hover:bg-[#393552]/60 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
            tabIndex={-1}
            aria-label="Emoji"
            onClick={() => {
              if (inputRef.current) {
                cursorPosRef.current = inputRef.current.selectionStart;
              }
              setShowEmoji((v) => !v);
              setTimeout(() => {
                if (inputRef.current) inputRef.current.focus();
              }, 0);
            }}
          >
            😀
          </button>
          {showEmoji && (
            <div style={{ position: 'absolute', bottom: '44px', left: 0, zIndex: 100 }} onMouseDown={e => e.preventDefault()}>
              <Picker
                data={data}
                theme="dark"
                onEmojiSelect={handleEmojiSelect}
                previewPosition="none"
                skinTonesPosition="none"
                style={{ background: '#232136', borderRadius: 16 }}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          className="text-2xl px-3 py-2 rounded-full hover:bg-[#393552]/60 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-pink-400"
          aria-label="Attach"
          onClick={() => fileInputRef.current.click()}
        >
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle text-gray-400" viewBox="0 0 24 24"><path d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 01-7.78-7.78l9.19-9.19a3.5 3.5 0 014.95 4.95l-9.19 9.19a1.5 1.5 0 01-2.12-2.12l8.49-8.49"/></svg>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
          />
        </button>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <input
            ref={inputRef}
            className="flex-1 px-5 py-3 rounded-full border-none outline-none bg-transparent text-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-400 transition-all duration-200 shadow-none"
            type="text"
            placeholder="Message..."
            value={message}
            onChange={handleInputChange}
            style={{ position: 'relative', zIndex: 1, background: 'transparent', fontFamily: 'inherit' }}
            onSelect={handleInputSelect}
            onClick={handleInputSelect}
            onKeyUp={handleInputSelect}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
          />
        </div>
        <button
          type="submit"
          className="ml-2 px-5 py-3 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-yellow-400 text-white font-bold shadow-lg text-lg hover:scale-105 transition-transform duration-200"
          aria-label="Send"
        >
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        </button>
        {image && (
          <div className="absolute left-0 bottom-14 bg-[#232136] p-2 rounded-lg shadow-lg flex items-center">
            <img src={image} alt="preview" className="w-20 h-20 object-cover rounded-lg mr-2" />
            <button type="button" className="text-red-400 font-bold" onClick={() => setImage(null)}>Remove</button>
          </div>
        )}
      </form>
    </div>
  );
}

export default ChatInput; 