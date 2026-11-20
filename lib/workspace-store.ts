import { seed, normalizeState, type State } from './model';
import { AppError } from './errors';
type WorkspaceRow = { data: string; revision: number };
type AccountProfile = {
  id: string;
  login: string;
  name: string;
  role: State['actors'][number]['role'];
  team: string;
  must_reset: number;
};

/** D1 persistence is separate from domain transitions and HTTP/session handling. */
export async function loadWorkspace(db: D1Database, owner: string, actorId: string | null) {
  const select = () =>
    db
      .prepare('SELECT data, revision FROM flow_workspaces WHERE owner_id = ?')
      .bind(owner)
      .first<WorkspaceRow>();
  let row = await select();
  if (!row) {
    await db
      .prepare('INSERT OR IGNORE INTO flow_workspaces (owner_id,data,revision) VALUES (?,?,0)')
      .bind(owner, JSON.stringify(seed()))
      .run();
    row = await select();
  }
  if (!row) throw new AppError('워크스페이스를 불러올 수 없습니다.', 503);
  const state = normalizeState(JSON.parse(row.data) as State);
  if (actorId) {
    if (!state.actors.some((actor) => actor.id === actorId))
      throw new AppError('계정을 찾을 수 없습니다.', 403);
    state.actorId = actorId;
  }
  const accounts = await db
    .prepare('SELECT id,login,name,role,team,must_reset FROM actors WHERE workspace_owner_id = ?')
    .bind(owner)
    .all<AccountProfile>();
  for (const account of accounts.results) {
    const profile = state.actors.find((actor) => actor.id === account.id);
    if (profile)
      Object.assign(profile, {
        login: account.login,
        name: account.name,
        role: account.role,
        team: account.team,
        mustReset: Boolean(account.must_reset),
      });
  }
  return { state, revision: row.revision };
}
export async function saveWorkspace(
  db: D1Database,
  owner: string,
  state: State,
  revision: number,
  credential: D1PreparedStatement | null = null,
) {
  const update = db
    .prepare(
      'UPDATE flow_workspaces SET data = ?, revision = revision + 1 WHERE owner_id = ? AND revision = ?',
    )
    .bind(JSON.stringify(state), owner, revision);
  // Preserve one transaction and the revision guard on account credential writes.
  const results = await db.batch(credential ? [credential, update] : [update]);
  if (!results[results.length - 1].meta.changes) {
    throw new AppError('동시 변경이 발생했습니다. 다시 확인해 주세요.', 409);
  }
}
