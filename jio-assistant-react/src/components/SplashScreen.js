import React, { useEffect, useState } from 'react';

export default function SplashScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); return 100; }
        return p + 2;
      });
    }, 48);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#04060f',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      animation: progress === 100 ? 'fadeOut 0.4s ease 0.2s both' : 'none',
    }}>
      <style>{`
        @keyframes fadeOut { to { opacity: 0; pointer-events: none; } }
        @keyframes ringPulse {
          0%   { box-shadow: 0 0 0 0 rgba(0,153,255,0.5); }
          70%  { box-shadow: 0 0 0 22px rgba(0,153,255,0); }
          100% { box-shadow: 0 0 0 0 rgba(0,153,255,0); }
        }
        @keyframes scaleUp {
          from { transform: scale(0.7); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes slideUpFade {
          from { transform: translateY(14px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Ring + Logo */}
      <div style={{
        width: 120, height: 120, borderRadius: '50%',
        border: '2px solid rgba(0,153,255,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'ringPulse 2s infinite, scaleUp 0.5s ease 0.1s both',
        marginBottom: 28,
      }}>
        <div style={{
          width: 92, height: 92, borderRadius: '50%',
          background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Reliance_Jio_Logo.svg/330px-Reliance_Jio_Logo.svg.png"
            alt="Jio"
            style={{ width: 80, objectFit: 'contain' }}
          />
        </div>
      </div>

      {/* Brand */}
      <div style={{
        fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 700,
        letterSpacing: '2px', color: '#f0f4ff', marginBottom: 6,
        animation: 'slideUpFade 0.5s ease 0.5s both',
      }}>
        Reliance <span style={{ color: '#0099ff' }}>Jio</span>
      </div>

      <div style={{
        fontSize: 12, color: '#3d4d66', letterSpacing: '3px',
        textTransform: 'uppercase', marginBottom: 44,
        animation: 'slideUpFade 0.5s ease 0.7s both',
      }}>
        Employee Assistant Portal
      </div>

      {/* Progress bar */}
      <div style={{
        width: 180, height: 2, background: 'rgba(255,255,255,0.06)',
        borderRadius: 2, overflow: 'hidden',
        animation: 'slideUpFade 0.5s ease 0.9s both',
      }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: 'linear-gradient(90deg, #0066cc, #00aaff)',
          borderRadius: 2,
          transition: 'width 0.08s linear',
        }} />
      </div>
    </div>
  );
}
