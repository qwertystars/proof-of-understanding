import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import TopicList from './pages/TopicList';
import TopicDetail from './pages/TopicDetail';
import CreateTopic from './pages/CreateTopic';

export default function App() {
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <h1>Proof of <span>Understanding</span></h1>
          </Link>
          <Link to="/create">
            <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              + New Topic
            </button>
          </Link>
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
