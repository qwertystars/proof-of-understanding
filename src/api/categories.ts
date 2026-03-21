import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

type Bindings = { DB: D1Database };
type Variables = { userId: string };

export const categoriesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET /api/categories — list all categories, pinned first, then alphabetical
categoriesRoutes.get('/', async (c) => {
  const search = c.req.query('search');

  let query = 'SELECT * FROM categories';
  const params: any[] = [];

  if (search) {
    query += ' WHERE name LIKE ?';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY pinned DESC, name ASC';

  const categories = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ categories: categories.results });
});

// POST /api/categories — create category (requires registered user)
const createCategorySchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(200).optional(),
});

categoriesRoutes.post('/', zValidator('json', createCategorySchema), async (c) => {
  const userId = c.get('userId');

  // Check if user is registered
  const user = await c.env.DB.prepare('SELECT is_registered FROM users WHERE id = ?').bind(userId).first() as any;
  if (!user?.is_registered) {
    return c.json({ error: 'You must be logged in to create categories' }, 403);
  }

  const { name, description } = c.req.valid('json');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  try {
    await c.env.DB.prepare(
      'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)'
    ).bind(name, slug, description || '').run();
    return c.json({ message: 'Category created', slug }, 201);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return c.json({ error: 'Category already exists' }, 409);
    }
    throw e;
  }
});
