CREATE TABLE IF NOT EXISTS actors (
 id TEXT PRIMARY KEY,
 login TEXT NOT NULL UNIQUE COLLATE NOCASE,
 workspace_owner_id TEXT NOT NULL,
 name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('requester','staff','admin')),
 team TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 password_salt TEXT NOT NULL,
 must_reset INTEGER NOT NULL DEFAULT 1,
 credential_version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS actor_sessions (
 token_hash TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL REFERENCES actors(id),
 credential_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS actor_sessions_actor ON actor_sessions(actor_id);
