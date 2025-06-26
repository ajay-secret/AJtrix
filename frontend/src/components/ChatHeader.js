import React, { useEffect, useRef, useState } from 'react';

function ChatHeader({ friendName = 'Friend', online = true, avatar, isFriendPeeking, onBack, onSetSharedPassword }) {
  const [swirl, setSwirl] = useState(false);
  const prevPeeking = useRef(isFriendPeeking);

  useEffect(() => {
    // Swirl on mount (first render)
    setSwirl(true);
    const timeout = setTimeout(() => setSwirl(false), 1500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    // Swirl when peeking goes from true to false
    if (prevPeeking.current && !isFriendPeeking) {
      setSwirl(true);
      const timeout = setTimeout(() => setSwirl(false), 1500);
      return () => clearTimeout(timeout);
    }
    prevPeeking.current = isFriendPeeking;
  }, [isFriendPeeking]);

  return (
    <div className="relative w-full">
      {/* Header bar with glassmorphism and modern style */}
      <div className="flex items-center px-6 py-4 bg-[#232136]/80 backdrop-blur-md shadow-xl rounded-t-2xl w-full border-b border-[#393552]/60" style={{boxShadow: '0 4px 32px 0 rgba(30, 30, 60, 0.25)'}}>
        {/* Back button on the left */}
        <button
          className="mr-4 text-yellow-400 hover:text-white font-bold text-2xl transition-colors duration-200 bg-[#232136]/80 border border-[#393552]/60 rounded-full p-2 shadow-lg hover:bg-gradient-to-tr hover:from-yellow-400 hover:to-purple-500 hover:text-[#232136] focus:outline-none focus:ring-2 focus:ring-yellow-400"
          onClick={onBack}
          style={{ boxShadow: '0 2px 12px 0 rgba(255, 220, 80, 0.12)' }}
          title="Back to contacts"
        >
          &larr;
        </button>
        <div className="flex items-center gap-4 flex-1">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-2xl relative bg-gradient-to-tr from-purple-500 via-pink-500 to-yellow-400 text-white shadow-lg ${online ? 'ring-2 ring-green-400' : 'ring-2 ring-gray-700'}`}
            style={{boxShadow: '0 2px 12px 0 rgba(80, 60, 120, 0.25)'}}>
            {avatar || friendName[0]?.toUpperCase()}
            {online && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#232136]"></span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="font-extrabold text-lg sm:text-2xl text-white tracking-wide">{friendName}</div>
            {/* Set Shared Password Button */}
            <button
              className="ml-2 px-2 py-1 rounded-full bg-[#393552] hover:bg-yellow-500 text-yellow-400 hover:text-white transition-colors duration-200 text-lg"
              title="Set Shared Password for this chat"
              onClick={onSetSharedPassword}
              style={{lineHeight: 1}}
            >
              <span role="img" aria-label="Set Password">🔒</span>
            </button>
          </div>
          <div className="text-xs sm:text-sm ml-2 mt-1">{online ? <span className="text-green-400">Online</span> : <span className="text-gray-400">Offline</span>}</div>
        </div>
        {/* Peeking indicator at top right, centered vertically in the bar */}
        <div className={`w-12 h-12 rounded-full border-2 border-gray-600 flex items-center justify-center bg-[#18122B]/80 overflow-hidden ml-4 transition-shadow duration-300 ${isFriendPeeking ? 'shadow-[0_0_16px_4px_rgba(255,200,100,0.25)]' : ''}`}
          style={isFriendPeeking ? {boxShadow: '0 0 24px 4px #facc15aa'} : {}}>
          {isFriendPeeking ? (
            <div
              className="flex items-center justify-center passport-peek-anim"
              style={{
                animation: 'passportPeekIn 0.7s cubic-bezier(.68,-0.55,.27,1.55)',
                animationFillMode: 'forwards',
                position: 'relative',
              }}
            >
              {/* SVG: Human-like passport photo */}
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <ellipse cx="20" cy="33" rx="12" ry="7" fill="#b0a7a7" />
                <ellipse cx="20" cy="18" rx="8" ry="10" fill="#f3d6b6" />
                <ellipse cx="20" cy="13" rx="8" ry="6" fill="#6d4c41" />
                <ellipse cx="17" cy="19" rx="1.2" ry="1.5" fill="#333" />
                <ellipse cx="23" cy="19" rx="1.2" ry="1.5" fill="#333" />
                <ellipse cx="20" cy="22" rx="0.7" ry="1.2" fill="#e2b48c" />
                <path d="M17 25 Q20 28 23 25" stroke="#c97b5a" strokeWidth="1.5" fill="none" />
              </svg>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
              {/* SVG well illusion: multiple receding rings, perfectly centered */}
              <svg width="40" height="40" viewBox="0 0 48 48" className={swirl ? 'swirl-anim' : ''} style={{zIndex: 2, display: 'block'}}>
                <defs>
                  <radialGradient id="wellGrad" cx="50%" cy="60%" r="60%">
                    <stop offset="0%" stopColor="#232136" />
                    <stop offset="80%" stopColor="#18122B" />
                    <stop offset="100%" stopColor="#0a0714" />
                  </radialGradient>
                </defs>
                {/* Outer ring */}
                <ellipse cx="24" cy="28" rx="22" ry="22" fill="url(#wellGrad)" />
                {/* Layered rings for well illusion */}
                <ellipse cx="24" cy="28" rx="18" ry="18" fill="none" stroke="#232136" strokeWidth="3" opacity="0.7" />
                <ellipse cx="24" cy="28" rx="14" ry="14" fill="none" stroke="#18122B" strokeWidth="3" opacity="0.7" />
                <ellipse cx="24" cy="28" rx="10" ry="10" fill="none" stroke="#0a0714" strokeWidth="3" opacity="0.8" />
                <ellipse cx="24" cy="28" rx="6" ry="6" fill="#0a0714" opacity="0.95" />
                {/* Subtle shadow for depth */}
                <ellipse cx="24" cy="32" rx="8" ry="2.5" fill="#000" opacity="0.18" />
              </svg>
              {/* Faint glimmer at the center */}
              <div className="absolute left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2 w-3 h-1.5 rounded-full bg-gradient-to-r from-[#fff6] to-[#fff0] blur-sm opacity-60 z-10" />
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes passportPeekIn {
          0% { opacity: 0; transform: scale(0.2); }
          60% { opacity: 1; transform: scale(1.1); }
          80% { transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        .passport-peek-anim {
          transition: opacity 0.3s, transform 0.3s;
          will-change: opacity, transform;
        }
        @keyframes swirl-well { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .swirl-anim { animation: swirl-well 1.5s cubic-bezier(.68,-0.55,.27,1.55); }
      `}</style>
    </div>
  );
}

export default ChatHeader; 