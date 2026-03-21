import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { topicsRoutes } from './api/topics';
import { authRoutes } from './api/auth';
import { authMiddleware } from './middleware/auth';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/api/*', cors());
app.use('/api/*', authMiddleware);

app.route('/api/topics', topicsRoutes);
app.route('/api/auth', authRoutes);

export default app;
