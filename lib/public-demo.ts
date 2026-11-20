import { seed, normalizeState, State } from './model';
import { act } from './actions';
import { AppError } from './errors';
export function newPublicDemo(): State {
  return seed();
}
export function readPublicDemo(raw: string | null): State {
  try {
    if (!raw) return newPublicDemo();
    const value = JSON.parse(raw);
    if (
      !value ||
      !Array.isArray(value.actors) ||
      !Array.isArray(value.products) ||
      !value.actors.some((a: any) => a.id === value.actorId)
    )
      return newPublicDemo();
    return normalizeState(value);
  } catch {
    return newPublicDemo();
  }
}
export function applyPublicDemo(current: State, action: string, data: any): State {
  if (['account-create', 'account-reset'].includes(action))
    throw new AppError('실제 계정 발급은 로그인한 관리자만 사용할 수 있습니다.', 403);
  const next = JSON.parse(JSON.stringify(current)) as State;
  act(next, action, data);
  return next;
}
