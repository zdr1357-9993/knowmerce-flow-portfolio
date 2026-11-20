import { State, Actor, uid, iso } from './model';
import { AppError } from './errors';
import { passwordHash, sessionToken } from './review-crypto';
export const validatePassword = (p: unknown) => {
  if (typeof p !== 'string' || p.length < 8 || p.length > 128)
    throw new AppError('비밀번호는 8~128자로 입력해주세요.');
  return p;
};
export async function accountMutation(
  db: D1Database,
  owner: string,
  state: State,
  revision: number,
  action: string,
  data: any,
  reservedLogin: string,
) {
  const actor = state.actors.find((a) => a.id === state.actorId);
  if (actor?.role !== 'admin') throw new AppError('계정은 물류 어드민만 관리할 수 있습니다.', 403);
  const salt = sessionToken(),
    hash = await passwordHash(validatePassword(data.password), salt);
  const guard = 'EXISTS (SELECT 1 FROM flow_workspaces WHERE owner_id = ? AND revision = ?)';
  let statement: D1PreparedStatement, target: Actor;
  if (action === 'account-create') {
    const login = String(data.login || '')
        .trim()
        .toLowerCase(),
      name = String(data.name || '').trim(),
      team = String(data.team || '').trim();
    if (!/^[a-z0-9][a-z0-9._-]{3,39}$/.test(login))
      throw new AppError('ID는 영문·숫자·점·밑줄·하이픈 4~40자로 입력해주세요.');
    if (login === reservedLogin.toLowerCase()) throw new AppError('사용할 수 없는 ID입니다.');
    if (
      !name ||
      name.length > 80 ||
      !team ||
      team.length > 80 ||
      !['admin', 'staff', 'requester'].includes(data.role)
    )
      throw new AppError('이름·역할·팀을 확인해주세요.');
    if (await db.prepare('SELECT id FROM actors WHERE login = ?').bind(login).first())
      throw new AppError('이미 사용 중인 ID입니다.', 409);
    target = { id: uid('ACT-'), login, name, team, role: data.role, mustReset: true };
    state.actors.push(target);
    statement = db
      .prepare(
        `INSERT INTO actors(id,login,workspace_owner_id,name,role,team,password_hash,password_salt,must_reset,credential_version,created_at) SELECT ?,?,?,?,?,?,?,?,1,1,? WHERE ${guard}`,
      )
      .bind(target.id, login, owner, name, data.role, team, hash, salt, iso(), owner, revision);
  } else {
    target = state.actors.find((a) => a.id === data.id)!;
    const row = await db
      .prepare('SELECT id FROM actors WHERE id = ? AND workspace_owner_id = ?')
      .bind(data.id || '', owner)
      .first();
    if (!target || !row) throw new AppError('직접 발급한 계정만 비밀번호를 초기화할 수 있습니다.');
    target.mustReset = true;
    statement = db
      .prepare(
        `UPDATE actors SET password_hash = ?, password_salt = ?, must_reset = 1, credential_version = credential_version + 1 WHERE id = ? AND workspace_owner_id = ? AND ${guard}`,
      )
      .bind(hash, salt, target.id, owner, owner, revision);
  }
  state.audits.unshift({
    id: uid('LOG-'),
    at: iso(),
    actor: actor.id,
    action: action === 'account-create' ? '계정 생성' : '비밀번호 초기화',
    target: target.id,
    before: '',
    after: JSON.stringify({
      login: target.login,
      name: target.name,
      role: target.role,
      team: target.team,
      mustReset: true,
    }),
  });
  return statement;
}
