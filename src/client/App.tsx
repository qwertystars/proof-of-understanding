import React, { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import TopicList from './pages/TopicList';
import TopicDetail from './pages/TopicDetail';
import CreateTopic from './pages/CreateTopic';
import { api } from './lib/api';

interface User {
  id: string;
  email?: string;
  display_name?: string;
  is_registered: number;
  avatar_url?: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api.getMe().then(setUser).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    window.location.reload();
  };

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <h1>Proof of <span>Understanding</span></h1>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user?.is_registered ? (
              <>
                <Link to="/create">
                  <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                    + New Topic
                  </button>
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {user.avatar_url && (
                    <img src={user.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                  )}
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                    {user.display_name || user.email || 'User'}
                  </span>
                  <button onClick={handleLogout} style={{ background: 'none', color: 'var(--text-light)', fontSize: '0.8rem', padding: '4px 8px', textDecoration: 'underline' }}>
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <a href="/api/auth/google">
                <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  Sign in with Google
                </button>
              </a>
            )}
          </div>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<TopicList />} />
          <Route path="/topic/:id" element={<TopicDetail />} />
          <Route path="/create" element={<CreateTopic />} />
        </Routes>
      </main>
    </>
  );
}
