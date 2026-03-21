-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  display_name TEXT,
  is_registered INTEGER DEFAULT 0,
  merged_into TEXT,
  ip_address TEXT,
  fingerprint TEXT,
  is_throttled INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Topics table
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  arguments_for TEXT NOT NULL DEFAULT '[]',
  arguments_against TEXT NOT NULL DEFAULT '[]',
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  pass_rate_for REAL DEFAULT 0,
  pass_rate_against REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  closes_at TEXT,
  flagged INTEGER DEFAULT 0,
  flag_count INTEGER DEFAULT 0,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Quiz questions
CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  target_side TEXT NOT NULL CHECK(target_side IN ('for', 'against')),
  question_text TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

-- Quiz sessions
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id TEXT PRIMARY KEY,
  topic_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  position TEXT NOT NULL CHECK(position IN ('for', 'against')),
  salt TEXT NOT NULL,
  shuffled_mapping TEXT NOT NULL DEFAULT '[]',
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'submitted', 'expired')),
  created_at TEXT DEFAULT (datetime('now')),
  submitted_at TEXT,
  FOREIGN KEY (topic_id) REFERENCES topics(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Votes (one per user per topic)
CREATE TABLE IF NOT EXISTS votes (
  topic_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  position TEXT NOT NULL CHECK(position IN ('for', 'against')),
  quiz_score REAL NOT NULL,
  voted_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (topic_id, user_id),
  FOREIGN KEY (topic_id) REFERENCES topics(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Quiz attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  topic_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  position TEXT NOT NULL CHECK(position IN ('for', 'against')),
  score REAL NOT NULL,
  answers TEXT NOT NULL DEFAULT '[]',
  passed INTEGER NOT NULL DEFAULT 0,
  attempted_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES quiz_sessions(id),
  FOREIGN KEY (topic_id) REFERENCES topics(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  PRIMARY KEY (user_id, action, window_start),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Flags table  
CREATE TABLE IF NOT EXISTS flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(topic_id, user_id),
  FOREIGN KEY (topic_id) REFERENCES topics(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_topic ON quiz_questions(topic_id, target_side);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user ON quiz_sessions(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_votes_topic ON votes(topic_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(user_id, action);
