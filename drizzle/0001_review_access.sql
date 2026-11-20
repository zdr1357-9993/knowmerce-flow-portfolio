CREATE TABLE IF NOT EXISTS review_sessions (token_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS review_login_attempts (attempt_key TEXT PRIMARY KEY, failures INTEGER NOT NULL, window_start INTEGER NOT NULL);
