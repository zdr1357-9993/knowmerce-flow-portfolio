import { env } from 'cloudflare:workers';
import { reviewSession } from '../../review-access';
import { validatePassword } from '../../../lib/accounts';
import {
  passwordHash,
  sessionToken,
  sessionCookie,
  digest,
  SESSION_LIFETIME,
  sameHash,
} from '../../../lib/review-crypto';
import { AppError } from '../../../lib/actions';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    if (req.headers.get('origin') !== url.origin)
      throw new AppError('허용되지 않은 요청입니다.', 403);
    const session = await reviewSession();
    if (!session?.actor_id || !session.must_reset || !env.DB)
      throw new AppError('비밀번호 재설정 로그인이 필요합니다.', 401);
    const raw = await req.text();
    if (raw.length > 2048) throw new AppError('입력값을 확인해주세요.');
    const data = JSON.parse(raw);
    const password = validatePassword(data.password);
    if (password !== data.confirm) throw new AppError('새 비밀번호가 일치하지 않습니다.');
    const db = env.DB,
      account = await db
        .prepare('SELECT password_hash,password_salt,credential_version FROM actors WHERE id = ?')
        .bind(session.actor_id)
        .first<any>();
    if (!account) throw new AppError('계정을 찾을 수 없습니다.', 401);
    if (sameHash(await passwordHash(password, account.password_salt), account.password_hash))
      throw new AppError('임시 비밀번호와 다른 비밀번호를 설정해주세요.');
    const salt = sessionToken(),
      hash = await passwordHash(password, salt),
      token = sessionToken(),
      tokenHash = await digest(token);
    const results = await db.batch([
      db
        .prepare(
          'UPDATE actors SET password_hash = ?, password_salt = ?, must_reset = 0, credential_version = credential_version + 1 WHERE id = ? AND credential_version = ? AND must_reset = 1',
        )
        .bind(hash, salt, session.actor_id, account.credential_version),
      db
        .prepare(
          'INSERT INTO actor_sessions(token_hash,actor_id,credential_version,expires_at) SELECT ?,id,credential_version,? FROM actors WHERE id = ? AND password_salt = ?',
        )
        .bind(tokenHash, Date.now() + SESSION_LIFETIME, session.actor_id, salt),
    ]);
    if (!results[0].meta.changes)
      throw new AppError('비밀번호가 이미 변경되었습니다. 다시 로그인해주세요.', 409);
    return Response.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Set-Cookie': sessionCookie(token, url.protocol === 'https:'),
        },
      },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof AppError ? e.message : '비밀번호 설정 중 오류가 발생했습니다.' },
      { status: e instanceof AppError ? e.status : 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
