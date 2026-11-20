import { AppError } from './errors';
export const MAX_BODY_BYTES = 2_000_000;
export const NO_STORE = { 'Cache-Control': 'no-store' };
type WorkspaceCommand = { action: string; data: Record<string, unknown>; revision: number };
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Validate the envelope here; domain modules validate individual action fields. */
export async function readWorkspaceCommand(req: Request): Promise<WorkspaceCommand> {
  if (req.headers.get('origin') !== new URL(req.url).origin) {
    throw new AppError('허용되지 않은 요청입니다.', 403);
  }
  if (Number(req.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
    throw new AppError('파일이 너무 큽니다.', 413);
  }
  // Count actual bytes, including multibyte text and bodies without Content-Length.
  const reader = req.body?.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY_BYTES) {
          await reader.cancel();
          throw new AppError('파일이 너무 큽니다.', 413);
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new AppError('올바른 JSON 요청을 보내주세요.');
  }
  if (!isObject(body) || typeof body.action !== 'string' || !body.action.trim()) {
    throw new AppError('처리할 동작을 확인해주세요.');
  }
  if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0) {
    throw new AppError('워크스페이스 버전을 확인해주세요.');
  }
  if (body.data !== undefined && !isObject(body.data)) {
    throw new AppError('입력 데이터 형식을 확인해주세요.');
  }
  return {
    action: body.action,
    data: isObject(body.data) ? body.data : {},
    revision: Number(body.revision),
  };
}
export function workspaceError(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json({ error: error.message }, { status: error.status, headers: NO_STORE });
  }
  const unique = error instanceof Error && error.message.includes('UNIQUE constraint');
  return Response.json(
    {
      error: unique
        ? '이미 사용 중인 ID입니다.'
        : '처리 중 오류가 발생했습니다. 다시 시도해주세요.',
    },
    { status: unique ? 409 : 500, headers: NO_STORE },
  );
}
