import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  author_name: string;
  tags: string[];
  views: number;
  created_at: string;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.getBlogPost(slug)
      .then(setPost)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'Z');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Simple markdown-like renderer: split by \n\n for paragraphs, ## for headings, ** for bold, > for quotes
  const renderContent = (content: string) => {
    // Normalize \r\n to \n (D1 may return Windows-style line endings)
    const normalized = content.replace(/\r\n/g, '\n');
    const blocks = normalized.split('\n\n');
    return blocks.map((block, i) => {
      const trimmed = block.trim();
      if (!trimmed) return null;
      
      if (trimmed.startsWith('## ')) {
        return <h2 key={i} style={{ fontSize: '1.5rem', fontFamily: 'var(--serif)', marginTop: '32px', marginBottom: '12px' }}>{trimmed.slice(3)}</h2>;
      }
      if (trimmed.startsWith('### ')) {
        return <h3 key={i} style={{ fontSize: '1.2rem', fontFamily: 'var(--serif)', marginTop: '24px', marginBottom: '8px' }}>{trimmed.slice(4)}</h3>;
      }
      if (trimmed.startsWith('> ')) {
        return (
          <blockquote key={i} style={{
            borderLeft: '3px solid var(--teal)',
            paddingLeft: '16px',
            margin: '20px 0',
            color: 'var(--text-light)',
            fontStyle: 'italic',
            fontSize: '1.05rem',
            lineHeight: 1.7,
          }}>
            {trimmed.slice(2)}
          </blockquote>
        );
      }
      if (trimmed.startsWith('---')) {
        return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '32px 0' }} />;
      }

      // Replace **text** with <strong>
      const parts = trimmed.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={i} style={{ fontSize: '1.05rem', lineHeight: 1.8, marginBottom: '16px', color: 'var(--text)' }}>
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
        </p>
      );
    });
  };

  if (loading) return <div className="loading"><div className="spinner" /><p>Loading article...</p></div>;
  if (error) return <div className="card" style={{ textAlign: 'center', padding: '48px' }}><h3>Article not found</h3><Link to="/blog"><button className="btn-primary" style={{ marginTop: '16px' }}>← Back to Blog</button></Link></div>;
  if (!post) return null;

  return (
    <div className="fade-in" style={{ maxWidth: '720px', margin: '0 auto' }}>
      <Link to="/blog" style={{ color: 'var(--teal)', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-block', marginBottom: '20px' }}>
        ← Back to The Brief
      </Link>

      <article>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
            <span className="category-badge">{post.category}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{formatDate(post.created_at)}</span>
          </div>
          <h1 style={{ fontSize: '2.2rem', fontFamily: 'var(--serif)', lineHeight: 1.2, marginBottom: '16px' }}>
            {post.title}
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-light)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '16px' }}>
            {post.excerpt}
          </p>
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-light)', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
            <span>By {post.author_name}</span>
            <span>·</span>
            <span>{post.views} views</span>
          </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          {renderContent(post.content)}
        </div>

        {post.tags.length > 0 && (
          <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {post.tags.map(tag => (
              <Link to={`/blog?tag=${tag}`} key={tag} style={{ textDecoration: 'none' }}>
                <span style={{ background: 'var(--bg)', padding: '4px 12px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-light)' }}>
                  #{tag}
                </span>
              </Link>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
