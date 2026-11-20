const assert = require('node:assert/strict');
const { readWorkspaceCommand, workspaceError, MAX_BODY_BYTES } = require('./workspace-http.js');
const { AppError } = require('./errors.js');

const request = (body, headers = {}) =>
  new Request('https://example.test/api/workspace', {
    method: 'POST',
    headers: { Origin: 'https://example.test', ...headers },
    body,
  });
let count = 0;
async function check(name, fn) {
  await fn();
  count++;
  console.log('PASS', name);
}
async function reject(body, status = 400, headers) {
  await assert.rejects(
    readWorkspaceCommand(request(body, headers)),
    (error) => error instanceof AppError && error.status === status,
  );
}
(async () => {
  await check('valid UTF-8 command retains action, input and revision', async () => {
    const data = { project: '한글 입출고' };
    assert.deepEqual(
      await readWorkspaceCommand(
        request(JSON.stringify({ action: 'save-draft', data, revision: 0 })),
      ),
      { action: 'save-draft', data, revision: 0 },
    );
  });
  await check('cross-origin writes are rejected', () =>
    reject('{}', 403, { Origin: 'https://other.test' }),
  );
  await check('malformed JSON and non-object envelopes are rejected', async () => {
    for (const raw of ['{', '', 'null', '[]', 'true', '1']) await reject(raw);
  });
  await check(
    'revisions must be nonnegative safe integers and data must be an object',
    async () => {
      for (const revision of [null, -1, 0.1, '1', 9007199254740992])
        await reject(JSON.stringify({ action: 'edit', revision }));
      for (const data of [null, [], 'x'])
        await reject(JSON.stringify({ action: 'edit', revision: 0, data }));
      for (const action of ['', ' ', null]) await reject(JSON.stringify({ action, revision: 0 }));
    },
  );
  await check('omitted action data defaults to an empty object', async () => {
    assert.deepEqual(
      (await readWorkspaceCommand(request('{"action":"switch","revision":1}'))).data,
      {},
    );
  });
  await check('byte limit applies without Content-Length and to multibyte input', async () => {
    await reject(
      JSON.stringify({
        action: 'edit',
        revision: 0,
        data: { note: '한'.repeat(Math.ceil(MAX_BODY_BYTES / 3)) },
      }),
      413,
    );
    await reject('{}', 413, { 'Content-Length': String(MAX_BODY_BYTES + 1) });
  });
  await check('unknown errors hide internals and all errors prevent caching', async () => {
    const response = workspaceError(new Error('database SQL/password_hash/private details'));
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert(!JSON.stringify(await response.json()).includes('password_hash'));
    assert.equal(workspaceError(new AppError('conflict', 409)).status, 409);
    assert.equal(workspaceError(new Error('UNIQUE constraint failed')).status, 409);
  });
  console.log(`${count} HTTP contract/security checks passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
