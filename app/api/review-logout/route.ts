import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { digest, sessionCookie } from '../../../lib/review-crypto';
import { prepareReviewStorage } from '../../review-access';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const url = new URL(req.url);
  if (req.headers.get('origin') !== url.origin)
    return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
  const token = (await cookies()).get('knowmerce_review')?.value;
  if (token && env.DB) {
    await prepareReviewStorage(env.DB);
    const hash = await digest(token);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM review_sessions WHERE token_hash = ?').bind(hash),
      env.DB.prepare('DELETE FROM actor_sessions WHERE token_hash = ?').bind(hash),
    ]);
  }
  return Response.json(
    { ok: true },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie('', url.protocol === 'https:', true),
      },
    },
  );
}
