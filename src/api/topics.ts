import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { nanoid } from 'nanoid';

type Bindings = { DB: D1Database };
type Variables = { userId: string };

export const topicsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET /api/topics - list paginated, filterable
topicsRoutes.get('/', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;
  const category = c.req.query('category');
  const status = c.req.query('status') || 'active';
  
  let query = 'SELECT id, title, description, category, votes_for, votes_against, pass_rate_for, pass_rate_against, status, created_at, closes_at FROM topics WHERE status = ?';
  const params: any[] = [status];
  
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const topics = await c.env.DB.prepare(query).bind(...params).all();
  
  const countQuery = category 
    ? await c.env.DB.prepare('SELECT COUNT(*) as total FROM topics WHERE status = ? AND category = ?').bind(status, category).first()
    : await c.env.DB.prepare('SELECT COUNT(*) as total FROM topics WHERE status = ?').bind(status).first();
  
  return c.json({
    topics: topics.results,
    pagination: {
      page,
      limit,
      total: (countQuery as any)?.total || 0,
    }
  });
});

// POST /api/topics - create topic with quiz questions
const createTopicSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  category: z.string().min(1).max(50),
  arguments_for: z.array(z.string()).min(1),
  arguments_against: z.array(z.string()).min(1),
  questions_for: z.array(z.object({
    question_text: z.string().min(10),
    options: z.array(z.string()).length(4),
    correct_index: z.number().min(0).max(3),
    explanation: z.string().min(1),
  })).min(3),
  questions_against: z.array(z.object({
    question_text: z.string().min(10),
    options: z.array(z.string()).length(4),
    correct_index: z.number().min(0).max(3),
    explanation: z.string().min(1),
  })).min(3),
});

topicsRoutes.post('/', zValidator('json', createTopicSchema), async (c) => {
  const data = c.req.valid('json');
  const userId = c.get('userId');
  
  // Basic keyword blocklist
  const blocklist = ['spam', 'test123'];
  const text = (data.title + ' ' + data.description).toLowerCase();
  if (blocklist.some(w => text.includes(w))) {
    return c.json({ error: 'Content flagged by moderation filter' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    `INSERT INTO topics (title, description, category, arguments_for, arguments_against, created_by) 
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    data.title,
    data.description,
    data.category,
    JSON.stringify(data.arguments_for),
    JSON.stringify(data.arguments_against),
    userId
  ).run();
  
  const topicId = result.meta.last_row_id;
  
  // Insert quiz questions for both sides
  const insertQ = c.env.DB.prepare(
    'INSERT INTO quiz_questions (topic_id, target_side, question_text, options, correct_index, explanation) VALUES (?, ?, ?, ?, ?, ?)'
  );
  
  const batch = [
    ...data.questions_for.map(q => 
      insertQ.bind(topicId, 'for', q.question_text, JSON.stringify(q.options), q.correct_index, q.explanation)
    ),
    ...data.questions_against.map(q => 
      insertQ.bind(topicId, 'against', q.question_text, JSON.stringify(q.options), q.correct_index, q.explanation)
    ),
  ];
  
  await c.env.DB.batch(batch);
  
  return c.json({ id: topicId, message: 'Topic created' }, 201);
});

// GET /api/topics/:id - topic detail with tallies
topicsRoutes.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  
  const topic = await c.env.DB.prepare(
    'SELECT * FROM topics WHERE id = ?'
  ).bind(id).first();
  
  if (!topic) return c.json({ error: 'Topic not found' }, 404);
  
  // Calculate understanding gap
  const understandingGap = Math.abs(
    ((topic as any).pass_rate_for || 0) - ((topic as any).pass_rate_against || 0)
  );
  
  // Check if current user has voted
  const userId = c.get('userId');
  const existingVote = await c.env.DB.prepare(
    'SELECT position, quiz_score FROM votes WHERE topic_id = ? AND user_id = ?'
  ).bind(id, userId).first();
  
  // Check if user has a passing quiz attempt
  const passingAttempt = await c.env.DB.prepare(
    'SELECT position, score FROM quiz_attempts WHERE topic_id = ? AND user_id = ? AND passed = 1 ORDER BY attempted_at DESC LIMIT 1'
  ).bind(id, userId).first();
  
  return c.json({
    ...topic,
    arguments_for: JSON.parse((topic as any).arguments_for || '[]'),
    arguments_against: JSON.parse((topic as any).arguments_against || '[]'),
    understanding_gap: understandingGap,
    user_vote: existingVote || null,
    user_passed_quiz: passingAttempt || null,
  });
});

// POST /api/topics/:id/quiz - start quiz session
const startQuizSchema = z.object({
  position: z.enum(['for', 'against']),
});

topicsRoutes.post('/:id/quiz', zValidator('json', startQuizSchema), async (c) => {
  const topicId = parseInt(c.req.param('id'));
  const { position } = c.req.valid('json');
  const userId = c.get('userId');
  
  // Check cooldown - use D1 server-side time comparison for reliability
  const cooldownCheck = await c.env.DB.prepare(
    `SELECT 1 FROM quiz_attempts 
     WHERE topic_id = ? AND user_id = ? AND position = ? AND passed = 0 
     AND attempted_at > datetime('now', '-60 seconds')
     LIMIT 1`
  ).bind(topicId, userId, position).first();
  
  if (cooldownCheck) {
    return c.json({ error: 'Please wait 60s before retrying', cooldown: 60 }, 429);
  }
  
  // User who picks FOR must prove they understand AGAINST → questions with target_side = 'against'
  const opposingSide = position === 'for' ? 'against' : 'for';
  
  const questions = await c.env.DB.prepare(
    'SELECT id, question_text, options, correct_index, explanation FROM quiz_questions WHERE topic_id = ? AND target_side = ?'
  ).bind(topicId, opposingSide).all();
  
  if (!questions.results || questions.results.length < 3) {
    return c.json({ error: 'Not enough quiz questions available' }, 400);
  }
  
  const sessionId = nanoid(21);
  const salt = nanoid(32);
  
  // Shuffle questions and option orders
  const shuffled = questions.results.map((q: any) => {
    const optionIndices = [0, 1, 2, 3];
    for (let i = optionIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [optionIndices[i], optionIndices[j]] = [optionIndices[j], optionIndices[i]];
    }
    
    return {
      question_id: q.id,
      original_correct: q.correct_index,
      option_shuffle: optionIndices,
      explanation: q.explanation,
    };
  });
  
  // Shuffle question order
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // Store session
  await c.env.DB.prepare(
    `INSERT INTO quiz_sessions (id, topic_id, user_id, position, salt, shuffled_mapping, status) 
     VALUES (?, ?, ?, ?, ?, ?, 'active')`
  ).bind(sessionId, topicId, userId, position, salt, JSON.stringify(shuffled)).run();
  
  // Build client payload- NO correct_index or explanation in plaintext
  const clientQuestions = shuffled.map((s: any) => {
    const originalQ = questions.results.find((q: any) => q.id === s.question_id) as any;
    const options = JSON.parse(originalQ.options);
    
    const shuffledOptions = s.option_shuffle.map((origIdx: number) => options[origIdx]);
    const newCorrectIndex = s.option_shuffle.indexOf(s.original_correct);
    const hashInput = `${s.question_id}${newCorrectIndex}${salt}`;
    
    return {
      question_id: s.question_id,
      question_text: originalQ.question_text,
      options: shuffledOptions,
      _hashInput: hashInput,
      _explanation: s.explanation || originalQ.explanation,
      _newCorrectIndex: newCorrectIndex,
    };
  });
  
  // Compute SHA-256 hashes and AES-GCM encrypted explanations
  const finalQuestions = [];
  for (const q of clientQuestions) {
    const encoder = new TextEncoder();
    const hashData = encoder.encode(q._hashInput);
    const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const answerHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(q._hashInput));
    const key = await crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(q._explanation)
    );
    
    const encryptedExplanation = {
      iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
      ciphertext: Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join(''),
    };
    
    finalQuestions.push({
      question_id: q.question_id,
      question_text: q.question_text,
      options: q.options,
      answer_hash: answerHash,
      encrypted_explanation: encryptedExplanation,
    });
  }
  
  return c.json({
    session_id: sessionId,
    salt,
    questions: finalQuestions,
    pass_threshold: 0.7,
    total_questions: finalQuestions.length,
  });
});

// POST /api/topics/:id/quiz/:sessionId/submit - submit quiz answers
const submitQuizSchema = z.object({
  answers: z.array(z.number().min(0).max(3)),
});

topicsRoutes.post('/:id/quiz/:sessionId/submit', zValidator('json', submitQuizSchema), async (c) => {
  const topicId = parseInt(c.req.param('id'));
  const sessionId = c.req.param('sessionId');
  const { answers } = c.req.valid('json');
  const userId = c.get('userId');
  
  const session = await c.env.DB.prepare(
    'SELECT * FROM quiz_sessions WHERE id = ? AND topic_id = ? AND user_id = ?'
  ).bind(sessionId, topicId, userId).first() as any;
  
  if (!session) return c.json({ error: 'Quiz session not found' }, 404);
  if (session.status !== 'active') return c.json({ error: 'Quiz already submitted' }, 400);
  
  const mapping = JSON.parse(session.shuffled_mapping);
  
  if (answers.length !== mapping.length) {
    return c.json({ error: `Expected ${mapping.length} answers, got ${answers.length}` }, 400);
  }
  
  // Server-side verification
  let correct = 0;
  const results: { question_id: number; correct: boolean; correct_answer: number }[] = [];
  
  for (let i = 0; i < mapping.length; i++) {
    const m = mapping[i];
    const newCorrectIndex = m.option_shuffle.indexOf(m.original_correct);
    const isCorrect = answers[i] === newCorrectIndex;
    if (isCorrect) correct++;
    results.push({
      question_id: m.question_id,
      correct: isCorrect,
      correct_answer: newCorrectIndex,
    });
  }
  
  const score = correct / mapping.length;
  const passed = score >= 0.7;
  
  await c.env.DB.prepare(
    `UPDATE quiz_sessions SET status = 'submitted', submitted_at = datetime('now') WHERE id = ?`
  ).bind(sessionId).run();
  
  await c.env.DB.prepare(
    `INSERT INTO quiz_attempts (session_id, topic_id, user_id, position, score, answers, passed) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(sessionId, topicId, userId, session.position, score, JSON.stringify(answers), passed ? 1 : 0).run();
  
  // Update topic pass rates
  if (passed) {
    const side = session.position;
    const passRateField = side === 'for' ? 'pass_rate_for' : 'pass_rate_against';
    
    const stats = await c.env.DB.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passes 
       FROM quiz_attempts WHERE topic_id = ? AND position = ?`
    ).bind(topicId, side).first() as any;
    
    const newRate = stats.total > 0 ? stats.passes / stats.total : 0;
    
    await c.env.DB.prepare(
      `UPDATE topics SET ${passRateField} = ? WHERE id = ?`
    ).bind(newRate, topicId).run();
  }
  
  return c.json({
    passed,
    score,
    correct,
    total: mapping.length,
    results,
    message: passed 
      ? 'You demonstrated understanding! You may now vote.' 
      : 'Keep learning! Review the opposing arguments and try again in 60 seconds.',
  });
});

// POST /api/topics/:id/vote - cast vote
const voteSchema = z.object({
  position: z.enum(['for', 'against']),
});

topicsRoutes.post('/:id/vote', zValidator('json', voteSchema), async (c) => {
  const topicId = parseInt(c.req.param('id'));
  const { position } = c.req.valid('json');
  const userId = c.get('userId');
  
  const topic = await c.env.DB.prepare('SELECT status FROM topics WHERE id = ?').bind(topicId).first() as any;
  if (!topic) return c.json({ error: 'Topic not found' }, 404);
  if (topic.status !== 'active') return c.json({ error: 'Topic is not accepting votes' }, 400);
  
  const passingAttempt = await c.env.DB.prepare(
    'SELECT score FROM quiz_attempts WHERE topic_id = ? AND user_id = ? AND position = ? AND passed = 1 LIMIT 1'
  ).bind(topicId, userId, position).first() as any;
  
  if (!passingAttempt) {
    return c.json({ error: 'You must pass the understanding quiz before voting' }, 403);
  }
  
  const existing = await c.env.DB.prepare(
    'SELECT position FROM votes WHERE topic_id = ? AND user_id = ?'
  ).bind(topicId, userId).first();
  
  if (existing) {
    return c.json({ error: 'You have already voted on this topic' }, 409);
  }
  
  await c.env.DB.prepare(
    'INSERT INTO votes (topic_id, user_id, position, quiz_score) VALUES (?, ?, ?, ?)'
  ).bind(topicId, userId, position, passingAttempt.score).run();
  
  const voteField = position === 'for' ? 'votes_for' : 'votes_against';
  await c.env.DB.prepare(
    `UPDATE topics SET ${voteField} = ${voteField} + 1 WHERE id = ?`
  ).bind(topicId).run();
  
  return c.json({ message: 'Vote cast successfully', position });
});

// POST /api/topics/:id/flag
topicsRoutes.post('/:id/flag', async (c) => {
  const topicId = parseInt(c.req.param('id'));
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  
  try {
    await c.env.DB.prepare(
      'INSERT INTO flags (topic_id, user_id, reason) VALUES (?, ?, ?)'
    ).bind(topicId, userId, body.reason || null).run();
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return c.json({ error: 'Already flagged' }, 409);
    }
    throw e;
  }
  
  await c.env.DB.prepare(
    `UPDATE topics SET flag_count = flag_count + 1, flagged = CASE WHEN flag_count + 1 >= 5 THEN 1 ELSE 0 END, status = CASE WHEN flag_count + 1 >= 5 THEN 'hidden' ELSE status END WHERE id = ?`
  ).bind(topicId).run();
  
  return c.json({ message: 'Topic flagged' });
});
