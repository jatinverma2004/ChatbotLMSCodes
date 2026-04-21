import React, { useState } from 'react';

const API = 'http://127.0.0.1:8100';

export default function LoginPage({ onLogin }) {
  const [empId, setEmpId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!empId.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/context/${empId.trim()}`);
      const data = await res.json();
      if (data.error) { setError('Employee ID not found.'); return; }
      onLogin({ uid: empId.trim(), profile: data.user_profile });
    } catch {
      setError('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#04060f',
      backgroundImage: `radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,102,204,0.12) 0%, transparent 70%)`,
    }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .login-card { animation: fadeUp 0.5s ease both; }
        .login-input {
          width: 100%; padding: 14px 16px;
          background: #0e1828; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; color: #f0f4ff; font-size: 15px;
          outline: none; transition: border-color 0.2s;
          font-family: 'DM Sans', sans-serif;
        }
        .login-input:focus { border-color: rgba(0,153,255,0.5); }
        .login-input::placeholder { color: #3d4d66; }
        .login-btn {
          width: 100%; padding: 14px;
          background: #0099ff; border: none; border-radius: 10px;
          color: #fff; font-size: 15px; font-weight: 600;
          cursor: pointer; transition: background 0.2s, transform 0.1s;
          font-family: 'DM Sans', sans-serif; letter-spacing: 0.3px;
        }
        .login-btn:hover { background: #007acc; }
        .login-btn:active { transform: scale(0.98); }
        .login-btn:disabled { background: #1e2d42; color: #3d4d66; cursor: not-allowed; }
      `}</style>

      <div className="login-card" style={{
        width: 380, background: '#0c1120',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20, padding: '40px 36px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#fff', display: 'flex',
            alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Reliance_Jio_Logo.svg/330px-Reliance_Jio_Logo.svg.png"
              alt="Jio" style={{ width: 52 }}
            />
          </div>
        </div>

        <h1 style={{
          fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700,
          textAlign: 'center', marginBottom: 6, color: '#f0f4ff',
        }}>
          Employee Assistant
        </h1>
        <p style={{ textAlign: 'center', color: '#7a8aaa', fontSize: 13, marginBottom: 32 }}>
          Sign in with your Employee ID
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#7a8aaa', marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Employee ID
            </label>
            <input
              className="login-input"
              placeholder="e.g. EMP001"
              value={empId}
              onChange={e => setEmpId(e.target.value)}
              autoFocus
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.2)',
              borderRadius: 8, padding: '10px 14px',
              color: '#ff4d6d', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button className="login-btn" type="submit" disabled={loading || !empId.trim()}>
            {loading ? 'Verifying...' : 'Continue'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#3d4d66', marginTop: 24 }}>
          Reliance Jio Infocomm Limited · Internal Use Only
        </p>
      </div>
    </div>
  );
}
