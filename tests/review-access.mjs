import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const compiled = spawnSync(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    'lib/review-crypto.ts',
    '--target',
    'ES2022',
    '--module',
    'commonjs',
    '--skipLibCheck',
    '--outDir',
    '.sites-runtime/tests',
  ],
  { stdio: 'inherit' },
);
if (compiled.status) process.exit(compiled.status);
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const {
  passwordHash,
  sameHash,
  sessionToken,
  digest,
  sessionCookie,
  SESSION_LIFETIME,
} = require('../.sites-runtime/tests/review-crypto.js');
const a = await passwordHash('test-only-password', 'example-salt'),
  b = await passwordHash('incorrect-password', 'example-salt');
assert.equal(a.length, 64);
assert(sameHash(a, await passwordHash('test-only-password', 'example-salt')));
assert(!sameHash(a, b));
assert(!sameHash(a, a.slice(1)));
assert(!sameHash(a, a + 'a'));
const token = sessionToken();
assert.match(token, /^[a-f0-9]{64}$/);
assert.notEqual(token, sessionToken());
assert.notEqual(token, await digest(token));
assert.equal((await digest(token)).length, 64);
assert(sessionCookie(token, true).includes('HttpOnly'));
assert(sessionCookie(token, true).includes('Secure'));
assert(!sessionCookie(token, false).includes('; Secure'));
assert(sessionCookie('', true, true).includes('Max-Age=0'));
assert.equal(SESSION_LIFETIME, 28800000);
console.log('Review login password hashing, token generation and session cookie checks passed.');
