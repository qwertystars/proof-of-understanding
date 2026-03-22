import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  author_name: string;
  tags: string[];
  views: number;
  created_at: string;
}

const BLOG_CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'explainer', label: 'Explainers' },
  { value: 'investigation', label: 'Investigations' },
  { value: 'opinion', label: 'Opinion' },
];

export default function BlogList() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('all');

  useEffect(() => {
    setLoading(true);
    api.getBlogPosts({ page, category: category === 'all' ? undefined : category })
      .then((data: any) => {
        setPosts(data.posts);
        setTotal(data.pagination.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, category]);

  const totalPages = Math.ceil(total / 20);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'Z');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>The Brief</h2>
        <p style={{ color: 'var(--text-light)', fontSize: '1.05rem' }}>
          Deep dives into the stories that shape how we understand each other.
        </p>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '28px' }}>
        {BLOG_CATEGORIES.map(cat => (
          <button
            key={cat.value}
            className={category === cat.value ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            onClick={() => { setCategory(cat.value); setPage(1); }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <p>Loading articles...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <h3>No articles yet</h3>
          <p style={{ color: 'var(--text-light)', marginTop: '8px' }}>Check back soon.</p>
        </div>
      ) : (
        <>
          <div className="blog-grid">
          {posts.map((post, i) => (
            <Link to={`/blog/${post.slug}`} key={post.id} style={{ textDecoration: 'none', color: 'inherit' }}>
              <article className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="category-badge">{post.category}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{formatDate(post.created_at)}</span>
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--serif)', lineHeight: 1.3, marginBottom: '8px' }}>
                    {post.title}
                  </h3>
                  <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '12px' }}>
                    {post.excerpt}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-light)', flexWrap: 'wrap' }}>
                  <span>By {post.author_name}</span>
                  <span>·</span>
                  <span>{post.views} views</span>
                  {post.tags.length > 0 && (
                    <>
                      <span>·</span>
                      {post.tags.slice(0, 3).map(tag => (
                        <span key={tag} style={{ background: 'var(--bg)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                          {tag}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </article>
            </Link>
          ))}
          </div>

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
