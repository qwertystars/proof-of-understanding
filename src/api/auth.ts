import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';

type Bindings = {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};
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
  const isSecure = c.req.url.startsWith('https');
  setCookie(c, 'pou_uid', user.id, {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  
  return c.json({ message: 'Logged in', user_id: user.id });
});

// GET /api/auth/google — redirect to Google OAuth consent screen
authRoutes.get('/google', async (c) => {
  const origin = new URL(c.req.url).origin;
  const redirectUri = `${origin}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// GET /api/auth/google/callback — handle Google OAuth callback
authRoutes.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.json({ error: 'Missing authorization code' }, 400);

  const origin = new URL(c.req.url).origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenRes.json() as any;
  if (!tokenData.access_token) {
    return c.json({ error: 'Failed to exchange authorization code' }, 400);
  }

  // Get user profile from Google
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileRes.json() as any;

  const googleId = profile.id;
  const email = profile.email;
  const displayName = profile.name || email;
  const avatarUrl = profile.picture || null;

  let finalUserId: string;

  // Check if user exists by google_id
  const existingByGoogle = await c.env.DB.prepare(
    'SELECT id FROM users WHERE google_id = ?'
  ).bind(googleId).first() as any;

  if (existingByGoogle) {
    finalUserId = existingByGoogle.id;
  } else {
    // Check if user exists by email
    const existingByEmail = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND is_registered = 1'
    ).bind(email).first() as any;

    if (existingByEmail) {
      // Link google_id to existing account
      await c.env.DB.prepare(
        'UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?'
      ).bind(googleId, avatarUrl, existingByEmail.id).run();
      finalUserId = existingByEmail.id;
    } else {
      // Upgrade current anonymous user
      const currentUserId = c.get('userId');
      await c.env.DB.prepare(
        `UPDATE users SET google_id = ?, email = ?, display_name = ?, avatar_url = ?, is_registered = 1 WHERE id = ?`
      ).bind(googleId, email, displayName, avatarUrl, currentUserId).run();
      finalUserId = currentUserId;
    }
  }

  const isSecure = c.req.url.startsWith('https');
  setCookie(c, 'pou_uid', finalUserId, {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  return c.redirect(`/?logged_in=1`);
});

// GET /api/auth/me — return current user info
authRoutes.get('/me', async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB.prepare(
    'SELECT id, email, display_name, is_registered, avatar_url FROM users WHERE id = ?'
  ).bind(userId).first() as any;

  if (!user || !user.is_registered) {
    return c.json({ id: userId, is_registered: false });
  }

  return c.json({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    is_registered: true,
    avatar_url: user.avatar_url,
  });
});

// POST /api/auth/logout — clear cookie
authRoutes.post('/logout', async (c) => {
  const isSecure = c.req.url.startsWith('https');
  setCookie(c, 'pou_uid', '', {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    maxAge: 0,
  });
  return c.json({ message: 'Logged out' });
});
