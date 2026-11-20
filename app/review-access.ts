import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { digest } from '../lib/review-crypto';
export async function prepareReviewStorage(db: D1Database) {
  await db.batch([
    db.prepare(
      'CREATE TABLE IF NOT EXISTS review_sessions (token_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL, expires_at INTEGER NOT NULL)',
    ),
    db.prepare(
      'CREATE TABLE IF NOT EXISTS review_login_attempts (attempt_key TEXT PRIMARY KEY, failures INTEGER NOT NULL, window_start INTEGER NOT NULL)',
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS actors (id TEXT PRIMARY KEY,login TEXT NOT NULL UNIQUE COLLATE NOCASE,workspace_owner_id TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('requester','staff','admin')),team TEXT NOT NULL,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,must_reset INTEGER NOT NULL DEFAULT 1,credential_version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL)",
    ),
    db.prepare(
      'CREATE TABLE IF NOT EXISTS actor_sessions (token_hash TEXT PRIMARY KEY,actor_id TEXT NOT NULL REFERENCES actors(id),credential_version INTEGER NOT NULL,expires_at INTEGER NOT NULL)',
    ),
  ]);
}
export type Session = {
  owner_id: string;
  expires_at: number;
  actor_id: string | null;
  must_reset: number;
};
export async function reviewSession(): Promise<Session | null> {
  if (!env.DB) return null;
  const token = (await cookies()).get('knowmerce_review')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  await prepareReviewStorage(env.DB);
  const hash = await digest(token);
  const managed = await env.DB.prepare(
    'SELECT a.workspace_owner_id AS owner_id,s.expires_at,a.id AS actor_id,a.must_reset FROM actor_sessions s JOIN actors a ON a.id = s.actor_id AND a.credential_version = s.credential_version WHERE s.token_hash = ? AND s.expires_at > ?',
  )
    .bind(hash, Date.now())
    .first<Session>();
  if (managed) return managed;
  return null;
}
