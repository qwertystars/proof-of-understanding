import { Context, Next } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { nanoid } from 'nanoid';

export const authMiddleware = async (c: Context, next: Next) => {
  let userId = getCookie(c, 'pou_uid');
  
  if (!userId) {
    userId = nanoid(21);
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO users (id, ip_address, created_at) VALUES (?, ?, datetime(\'now\'))'
    ).bind(userId, ip).run();
    
    const isSecure = c.req.url.startsWith('https');
    setCookie(c, 'pou_uid', userId, {
      path: '/',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }
  
  c.set('userId', userId);
  await next();
};
