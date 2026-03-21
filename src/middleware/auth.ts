import { Context, Next } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { nanoid } from 'nanoid';

export const authMiddleware = async (c: Context, next: Next) => {
  let userId = getCookie(c, 'pou_uid');
  
  // Detect country from Cloudflare's cf object
  const country = (c.req.raw as any).cf?.country || c.req.header('cf-ipcountry') || null;
  
  if (!userId) {
    userId = nanoid(21);
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO users (id, ip_address, country, created_at) VALUES (?, ?, ?, datetime(\'now\'))'
    ).bind(userId, ip, country).run();
    
    const isSecure = c.req.url.startsWith('https');
    setCookie(c, 'pou_uid', userId, {
      path: '/',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  } else if (country) {
    // Update country if not set yet
    await c.env.DB.prepare(
      'UPDATE users SET country = ? WHERE id = ? AND country IS NULL'
    ).bind(country, userId).run();
  }
  
  c.set('userId', userId);
  c.set('country', country);
  await next();
};
