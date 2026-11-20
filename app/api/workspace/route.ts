import { env } from 'cloudflare:workers';
import { reviewSession } from '../../review-access';
import { loadWorkspace, saveWorkspace } from '../../../lib/workspace-store';
import { readWorkspaceCommand, workspaceError } from '../../../lib/workspace-http';
import { act, visibleState, AppError } from '../../../lib/actions';
import { accountMutation } from '../../../lib/accounts';
export const dynamic = 'force-dynamic';
async function context() {
  const user = await reviewSession();
  if (!user) throw new AppError('로그인이 필요합니다.', 401);
  if (user.must_reset) throw new AppError('임시 비밀번호를 먼저 변경해주세요.', 403);
  if (!env.DB) throw new AppError('저장소를 준비하고 있습니다. 잠시 후 다시 시도해 주세요.', 503);
  return { owner: user.owner_id, session: user, db: env.DB };
}
export async function GET() {
  try {
    const { owner, db, session } = await context();
    const { state, revision } = await loadWorkspace(db, owner, session.actor_id);
    return Response.json(
      { state: visibleState(state), revision, demo: !session.actor_id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return workspaceError(e);
  }
}
export async function POST(req: Request) {
  try {
    const body = await readWorkspaceCommand(req);
    const { owner, db, session } = await context();
    const { state, revision } = await loadWorkspace(db, owner, session.actor_id);
    if (body.revision !== revision)
      throw new AppError(
        '다른 창에서 변경되었습니다. 최신 데이터를 불러온 뒤 다시 시도해 주세요.',
        409,
      );
    if (session.actor_id && body.action === 'switch')
      throw new AppError('발급 계정은 다른 사용자로 전환할 수 없습니다.', 403);
    let credential: D1PreparedStatement | null = null;
    if (['account-create', 'account-reset'].includes(body.action))
      credential = await accountMutation(
        db,
        owner,
        state,
        revision,
        body.action,
        body.data || {},
        env.REVIEW_LOGIN_ID || '',
      );
    else act(state, body.action, body.data || {});
    await saveWorkspace(db, owner, state, revision, credential);
    return Response.json(
      { state: visibleState(state), revision: revision + 1, demo: !session.actor_id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return workspaceError(e);
  }
}
