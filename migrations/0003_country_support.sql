-- Add country to users (ISO 3166-1 alpha-2 code, auto-detected from CF)
ALTER TABLE users ADD COLUMN country TEXT DEFAULT NULL;

-- Add target_countries to topics (JSON array of ISO country codes, NULL = global)
ALTER TABLE topics ADD COLUMN target_countries TEXT DEFAULT NULL;

-- Add region to topics for broader matching (e.g., "south-asia", "europe", "global")
ALTER TABLE topics ADD COLUMN region TEXT DEFAULT 'global';

-- Index for country-based filtering
CREATE INDEX IF NOT EXISTS idx_topics_region ON topics(region);
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);
