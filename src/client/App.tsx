import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import TopicList from './pages/TopicList';
import TopicDetail from './pages/TopicDetail';
import CreateTopic from './pages/CreateTopic';
import BlogList from './pages/BlogList';
import BlogPost from './pages/BlogPost';
import { api } from './lib/api';

interface User {
  id: string;
  email?: string;
  display_name?: string;
  is_registered: number;
  avatar_url?: string;
}

function NotFound() {
  return (
    <div className="fade-in" style={{ textAlign: 'center', padding: '80px 20px' }}>
      <h2 style={{ fontSize: '3rem', marginBottom: '12px', color: 'var(--teal)' }}>404</h2>
      <h3 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Page not found</h3>
      <p style={{ color: 'var(--text-light)', marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
        The page you're looking for doesn't exist. Maybe it was moved, or maybe you need to understand the other side first.
      </p>
      <Link to="/">
        <button className="btn-primary" style={{ padding: '12px 28px' }}>← Back to Topics</button>
      </Link>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  const [country, setCountry] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);

  useEffect(() => {
    api.getMe().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    api.getCountry().then((data: any) => {
      setCountry(data.detected || data.stored);
      setRegion(data.region);
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    navigate('/');
  };

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <h1>Proof of <span>Understanding</span></h1>
          </Link>
          <nav style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Link to="/" style={{ textDecoration: 'none', color: 'var(--text-light)', fontSize: '0.9rem', fontWeight: 500 }}>Topics</Link>
            <Link to="/blog" style={{ textDecoration: 'none', color: 'var(--text-light)', fontSize: '0.9rem', fontWeight: 500 }}>The Brief</Link>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {country && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card-bg)' }}>
                🌍 {country}
              </span>
            )}
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
          <Route path="/" element={<TopicList country={country} region={region} onCountryChange={(c: string, r: string) => { setCountry(c); setRegion(r); }} />} />
          <Route path="/topic/:id" element={<TopicDetail />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/create" element={<CreateTopic />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}
