import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface Topic {
  id: number;
  title: string;
  description: string;
  category: string;
  votes_for: number;
  votes_against: number;
  pass_rate_for: number;
  pass_rate_against: number;
  status: string;
  created_at: string;
}

const CATEGORIES = ['all', 'politics', 'technology', 'society', 'science', 'economics', 'philosophy', 'general'];

export default function TopicList() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('all');

  useEffect(() => {
    setLoading(true);
    api.getTopics({ page, category: category === 'all' ? undefined : category })
      .then((data: any) => {
        setTopics(data.topics);
        setTotal(data.pagination.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, category]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Explore Topics</h2>
        <p style={{ color: 'var(--text-light)' }}>
          Prove you understand the other side. Then vote.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={category === cat ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            onClick={() => { setCategory(cat); setPage(1); }}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <p>Loading topics...</p>
        </div>
      ) : topics.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <h3>No topics yet</h3>
          <p style={{ color: 'var(--text-light)', marginTop: '8px' }}>
            Be the first to <Link to="/create">create a topic</Link>
          </p>
        </div>
      ) : (
        <>
          {topics.map(topic => {
            const totalVotes = topic.votes_for + topic.votes_against;
            const forPct = totalVotes > 0 ? (topic.votes_for / totalVotes) * 100 : 50;
            const gap = Math.abs(topic.pass_rate_for - topic.pass_rate_against);
            
            return (
              <Link to={`/topic/${topic.id}`} key={topic.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <span className="category-badge">{topic.category}</span>
                      <h3 className="topic-title" style={{ marginTop: '8px' }}>{topic.title}</h3>
                      <p className="topic-meta">{topic.description.substring(0, 120)}...</p>
                    </div>
                  </div>
                  
                  <div className="gap-container">
                    <div className="gap-bar">
                      <div className="gap-bar-for" style={{ width: `${forPct}%` }} />
                      <div className="gap-bar-against" style={{ width: `${100 - forPct}%` }} />
                    </div>
                    <div className="gap-labels">
                      <span>For: {topic.votes_for}</span>
                      <span>Against: {topic.votes_against}</span>
                    </div>
                  </div>
                  
                  <div className="topic-stats">
                    <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>Understanding gap: {(gap * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </Link>
            );
          })}

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px', marginBottom: '48px' }}>
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '8px 16px' }}>
                ← Prev
              </button>
              <span style={{ padding: '8px 16px', color: 'var(--text-light)' }}>
                Page {page} of {totalPages}
              </span>
              <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '8px 16px' }}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
