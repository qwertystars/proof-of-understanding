import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { setCookie } from 'hono/cookie';

type Bindings = { DB: D1Database };
type Variables = { userId: string };

export const authRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// POST /api/auth/register
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(1).max(50).optional(),
});

authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, display_name } = c.req.valid('json');
  const userId = c.get('userId');
  
  // Check if email already taken
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return c.json({ error: 'Email already registered' }, 409);
  
  // Hash password using Web Crypto
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  const passwordHash = `${saltHex}:${hashHex}`;
  
  // Update anonymous user to registered
  await c.env.DB.prepare(
    `UPDATE users SET email = ?, password_hash = ?, display_name = ?, is_registered = 1 WHERE id = ?`
  ).bind(email, passwordHash, display_name || null, userId).run();
  
  return c.json({ message: 'Registered successfully', user_id: userId });
});

// POST /api/auth/login
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  
  const user = await c.env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE email = ? AND is_registered = 1'
  ).bind(email).first() as any;
  
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);
  
  // Verify password
  const [saltHex, hashHex] = user.password_hash.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const computedHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  if (computedHash !== hashHex) return c.json({ error: 'Invalid credentials' }, 401);
  
  // Merge anonymous user's data into registered account
  const currentAnonId = c.get('userId');
  if (currentAnonId !== user.id) {
    // Transfer votes
    await c.env.DB.prepare(
      'UPDATE OR IGNORE votes SET user_id = ? WHERE user_id = ?'
    ).bind(user.id, currentAnonId).run();
    // Transfer quiz attempts
    await c.env.DB.prepare(
      'UPDATE quiz_attempts SET user_id = ? WHERE user_id = ?'
    ).bind(user.id, currentAnonId).run();
    // Mark anonymous user as merged
    await c.env.DB.prepare(
      'UPDATE users SET merged_into = ? WHERE id = ?'
    ).bind(user.id, currentAnonId).run();
  }
  
  // Set cookie to registered user
  setCookie(c, 'pou_uid', user.id, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  
  return c.json({ message: 'Logged in', user_id: user.id });
});
