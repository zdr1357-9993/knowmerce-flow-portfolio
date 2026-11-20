import { env } from 'cloudflare:workers';
import { prepareReviewStorage } from '../../review-access';
import {
  digest,
  passwordHash,
  sameHash,
  sessionToken,
  sessionCookie,
  SESSION_LIFETIME,
} from '../../../lib/review-crypto';
export const dynamic = 'force-dynamic';
const reply = (error: string, status: number) =>
  Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    if (req.headers.get('origin') !== url.origin) return reply('허용되지 않은 요청입니다.', 403);
    if (!env.DB) return reply('저장소가 아직 설정되지 않았습니다.', 503);
    const raw = await req.text();
    if (raw.length > 2048) return reply('입력값을 확인해주세요.', 400);
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return reply('입력값을 확인해주세요.', 400);
    }
    const login = String(data.login || '').trim(),
      password = String(data.password || '');
    if (!login || !password || password.length > 256)
      return reply('아이디와 비밀번호를 입력해주세요.', 400);
    const db = env.DB;
    await prepareReviewStorage(db);
    if (env.REVIEW_LOGIN_ID && env.REVIEW_PASSWORD_HASH && env.REVIEW_PASSWORD_SALT)
      await db
        .prepare(
          "INSERT OR IGNORE INTO actors(id,login,workspace_owner_id,name,role,team,password_hash,password_salt,must_reset,credential_version,created_at) VALUES('admin',?,'knowmerce-main','이서준','admin','물류 운영팀',?,?,0,1,?)",
        )
        .bind(
          env.REVIEW_LOGIN_ID.toLowerCase(),
          env.REVIEW_PASSWORD_HASH,
          env.REVIEW_PASSWORD_SALT,
          new Date().toISOString(),
        )
        .run();
    const now = Date.now(),
      key = await digest(req.headers.get('cf-connecting-ip') || 'local-preview');
    const attempt = await db
      .prepare(
        'INSERT INTO review_login_attempts(attempt_key,failures,window_start) VALUES(?,1,?) ON CONFLICT(attempt_key) DO UPDATE SET failures=CASE WHEN window_start < ? THEN 1 ELSE failures+1 END, window_start=CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END RETURNING failures',
      )
      .bind(key, now, now - 600000, now - 600000)
      .first<{ failures: number }>();
    if ((attempt?.failures || 0) > 5)
      return reply('로그인 시도가 많습니다. 10분 후 다시 시도해주세요.', 429);
    const account = await db
      .prepare(
        'SELECT id,password_hash,password_salt,must_reset,credential_version FROM actors WHERE login = ?',
      )
      .bind(login.toLowerCase())
      .first<{
        id: string;
        password_hash: string;
        password_salt: string;
        must_reset: number;
        credential_version: number;
      }>();
    const salt = account?.password_salt || env.REVIEW_PASSWORD_SALT || 'unconfigured';
    const hashed = await passwordHash(password, salt);
    const valid = !!account && sameHash(hashed, account.password_hash);
    if (!valid) return reply('아이디 또는 비밀번호가 올바르지 않습니다.', 401);
    const token = sessionToken(),
      tokenHash = await digest(token);
    if (account) {
      const inserted = await db
        .prepare(
          'INSERT INTO actor_sessions(token_hash,actor_id,credential_version,expires_at) SELECT ?,id,credential_version,? FROM actors WHERE id = ? AND credential_version = ?',
        )
        .bind(tokenHash, now + SESSION_LIFETIME, account.id, account.credential_version)
        .run();
      if (!inserted.meta.changes)
        return reply('비밀번호가 변경되었습니다. 다시 로그인해주세요.', 401);
    } else {
      await db
        .prepare('INSERT INTO review_sessions(token_hash,owner_id,expires_at) VALUES(?,?,?)')
        .bind(tokenHash, 'review-' + sessionToken(), now + SESSION_LIFETIME)
        .run();
    }
    await db.batch([
      db.prepare('DELETE FROM review_login_attempts WHERE attempt_key = ?').bind(key),
      db.prepare('DELETE FROM review_sessions WHERE expires_at <= ?').bind(now),
      db.prepare('DELETE FROM actor_sessions WHERE expires_at <= ?').bind(now),
    ]);
    return Response.json(
      { ok: true, next: account?.must_reset ? '/setup-password' : '/' },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Set-Cookie': sessionCookie(token, url.protocol === 'https:'),
        },
      },
    );
  } catch {
    return reply('로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 500);
  }
}
