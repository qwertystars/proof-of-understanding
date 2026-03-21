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

interface Category {
  id: number;
  name: string;
  slug: string;
  pinned: number;
  topic_count: number;
}

interface TopicListProps {
  country: string | null;
  region: string | null;
  onCountryChange: (country: string, region: string) => void;
}

const REGIONS = [
  { value: 'all', label: 'All Regions' },
  { value: 'south-asia', label: 'South Asia' },
  { value: 'east-asia', label: 'East Asia' },
  { value: 'southeast-asia', label: 'SE Asia' },
  { value: 'europe', label: 'Europe' },
  { value: 'north-america', label: 'N. America' },
  { value: 'south-america', label: 'S. America' },
  { value: 'middle-east', label: 'Middle East' },
  { value: 'africa', label: 'Africa' },
  { value: 'oceania', label: 'Oceania' },
  { value: 'global', label: 'Global' },
];

export default function TopicList({ country, region: userRegion, onCountryChange }: TopicListProps) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [catSearch, setCatSearch] = useState('');
  const [showAllCats, setShowAllCats] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>('all');

  useEffect(() => {
    api.getCategories().then((data: any) => setCategories(data.categories)).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    api.getTopics({ page, category: category === 'all' ? undefined : category, region: regionFilter === 'all' ? undefined : regionFilter })
      .then((data: any) => {
        setTopics(data.topics);
        setTotal(data.pagination.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, category, regionFilter]);

  const totalPages = Math.ceil(total / 20);
  
  const pinnedCats = categories.filter(c => c.pinned);
  const filteredCats = catSearch 
    ? categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()))
    : showAllCats ? categories : pinnedCats;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Explore Topics</h2>
        <p style={{ color: 'var(--text-light)' }}>
          Prove you understand the other side. Then vote.
        </p>
      </div>

      {/* Region filter */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginRight: '4px' }}>🌍 Region:</span>
          {REGIONS.map(r => (
            <button
              key={r.value}
              className={regionFilter === r.value ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '12px' }}
              onClick={() => { setRegionFilter(r.value); setPage(1); }}
            >
              {r.label}
              {r.value === userRegion && regionFilter !== r.value && ' ✦'}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="Search categories..."
            value={catSearch}
            onChange={e => setCatSearch(e.target.value)}
            style={{
              padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '8px',
              fontSize: '0.85rem', fontFamily: 'var(--sans)', width: '180px', background: 'var(--card-bg)',
            }}
          />
          {!catSearch && (
            <button
              onClick={() => setShowAllCats(!showAllCats)}
              style={{ background: 'none', color: 'var(--teal)', fontSize: '0.8rem', padding: '4px 8px', textDecoration: 'underline' }}
            >
              {showAllCats ? 'Show less' : 'Show all'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={category === 'all' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            onClick={() => { setCategory('all'); setPage(1); }}
          >
            All
          </button>
          {filteredCats.map(cat => (
            <button
              key={cat.slug}
              className={category === cat.slug ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              onClick={() => { setCategory(cat.slug); setPage(1); }}
            >
              {cat.name} {cat.topic_count > 0 && <span style={{ opacity: 0.6 }}>({cat.topic_count})</span>}
            </button>
          ))}
        </div>
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
