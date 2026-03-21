import { Hono } from 'hono';

type Bindings = { DB: D1Database };
type Variables = { userId: string };

export const blogRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET /api/blog — list published posts (paginated)
blogRoutes.get('/', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;
  const category = c.req.query('category');
  const tag = c.req.query('tag');

  let query = 'SELECT id, title, slug, excerpt, category, author_name, tags, views, created_at FROM blog_posts WHERE published = 1';
  const params: any[] = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  if (tag) {
    query += ' AND tags LIKE ?';
    params.push(`%"${tag}"%`);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const posts = await c.env.DB.prepare(query).bind(...params).all();

  let countSql = 'SELECT COUNT(*) as total FROM blog_posts WHERE published = 1';
  const countParams: any[] = [];
  if (category) { countSql += ' AND category = ?'; countParams.push(category); }
  if (tag) { countSql += ' AND tags LIKE ?'; countParams.push(`%"${tag}"%`); }
  const count = await c.env.DB.prepare(countSql).bind(...countParams).first() as any;

  return c.json({
    posts: posts.results?.map((p: any) => ({ ...p, tags: JSON.parse(p.tags || '[]') })),
    pagination: { page, limit, total: count?.total || 0 },
  });
});

// GET /api/blog/:slug — single post by slug
blogRoutes.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const post = await c.env.DB.prepare(
    'SELECT * FROM blog_posts WHERE slug = ? AND published = 1'
  ).bind(slug).first() as any;

  if (!post) return c.json({ error: 'Post not found' }, 404);

  // Increment views
  await c.env.DB.prepare('UPDATE blog_posts SET views = views + 1 WHERE id = ?').bind(post.id).run();

  return c.json({
    ...post,
    tags: JSON.parse(post.tags || '[]'),
    views: post.views + 1,
  });
});
