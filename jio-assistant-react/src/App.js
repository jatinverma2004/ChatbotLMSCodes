import React, { useState, useEffect } from 'react';
import './index.css';
import SplashScreen from './components/SplashScreen';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  const [splash, setSplash] = useState(true);
  const [user, setUser] = useState(null); // { uid, profile }
  const [page, setPage] = useState('chat'); // chat | admin | dashboard

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 2800);
    return () => clearTimeout(t);
  }, []);

  if (splash) return <SplashScreen />;
  if (!user) return <LoginPage onLogin={setUser} />;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {page === 'chat' && (
        <ChatPage user={user} onLogout={() => setUser(null)} onNav={setPage} />
      )}
      {page === 'admin' && (
        <AdminPage user={user} onNav={setPage} />
      )}
      {page === 'dashboard' && (
        <DashboardPage user={user} onNav={setPage} />
      )}
    </div>
  );
}
