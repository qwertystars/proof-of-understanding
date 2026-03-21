-- Add categories table
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  pinned INTEGER DEFAULT 0,
  topic_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Seed default categories
INSERT INTO categories (name, slug, pinned) VALUES ('General', 'general', 1);
INSERT INTO categories (name, slug, pinned) VALUES ('Geopolitics', 'geopolitics', 1);
INSERT INTO categories (name, slug, pinned) VALUES ('Technology', 'technology', 1);
INSERT INTO categories (name, slug, pinned) VALUES ('Society', 'society', 0);
INSERT INTO categories (name, slug, pinned) VALUES ('Science', 'science', 0);
INSERT INTO categories (name, slug, pinned) VALUES ('Economics', 'economics', 0);
INSERT INTO categories (name, slug, pinned) VALUES ('Philosophy', 'philosophy', 0);
INSERT INTO categories (name, slug, pinned) VALUES ('Politics', 'politics', 0);

-- Update topic_count for existing topics
UPDATE categories SET topic_count = (
  SELECT COUNT(*) FROM topics WHERE topics.category = categories.slug
);

-- Add google_id column to users for OAuth
ALTER TABLE users ADD COLUMN google_id TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_pinned ON categories(pinned);
