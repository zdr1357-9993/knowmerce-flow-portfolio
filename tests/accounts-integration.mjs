import assert from 'node:assert/strict';
const base = process.env.TEST_BASE || 'http://localhost:5173';
let n = 0;
async function call(path, { cookie, body, method } = {}) {
  const r = await fetch(base + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json', Origin: base } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  let d;
  try {
    d = await r.json();
  } catch {
    d = null;
  }
  return { status: r.status, data: d, cookie: r.headers.get('set-cookie')?.split(';')[0] };
}
function ok(label, value) {
  assert(value, label);
  n++;
  console.log('PASS', label);
}
const adminLogin = process.env.TEST_ADMIN_LOGIN,
  adminPassword = process.env.TEST_ADMIN_PASSWORD;
if (!adminLogin || !adminPassword)
  throw new Error('Set TEST_ADMIN_LOGIN and TEST_ADMIN_PASSWORD for a local test account.');
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname))
  throw new Error('Account integration tests must target a local server.');
let admin = await call('/api/review-login', {
  body: { login: adminLogin, password: adminPassword },
});
ok('bootstrap admin login', admin.status === 200);
const ac = admin.cookie;
let state = await call('/api/workspace', { cookie: ac });
ok(
  'account bound to admin role',
  state.data.state.actorId === 'admin' && state.data.demo === false,
);
let revision = state.data.revision;
async function mutate(action, data, cookie = ac) {
  const current = await call('/api/workspace', { cookie });
  if (current.status !== 200) return current;
  return call('/api/workspace', {
    cookie,
    body: { action, data, revision: current.data.revision },
  });
}
const login = 'qa-user-' + Date.now(),
  temp = 'Initial-9284',
  next = 'Changed-6284',
  reset = 'Reset-5384';
let made = await mutate('account-create', {
  login,
  name: '검증용 요청자',
  team: 'QA 검증팀',
  role: 'requester',
  password: temp,
});
ok('administrator creates account', made.status === 200);
const actor = made.data.state.actors.find((a) => a.login === login),
  id = actor.id;
ok(
  'credential fields absent from returned state',
  !JSON.stringify(made.data).includes(temp) &&
    !JSON.stringify(made.data).includes('password_hash') &&
    !JSON.stringify(made.data).includes('password_salt'),
);
ok(
  'duplicate account ID rejected',
  (
    await mutate('account-create', {
      login,
      name: '중복',
      team: 'QA',
      role: 'staff',
      password: temp,
    })
  ).status === 409,
);
let r = await call('/api/review-login', { body: { login, password: temp } });
ok('first login requires password setup', r.status === 200 && r.data.next === '/setup-password');
let rc = r.cookie;
ok(
  'temporary session cannot access workspace',
  (await call('/api/workspace', { cookie: rc })).status === 403,
);
r = await call('/api/password-setup', { cookie: rc, body: { password: next, confirm: next } });
ok('user sets new password', r.status === 200);
rc = r.cookie;
state = await call('/api/workspace', { cookie: rc });
ok(
  'requester logs into same workspace with own identity',
  state.status === 200 && state.data.state.actorId === id && state.data.state.requests.length > 0,
);
ok(
  'requester cannot switch to admin',
  (await mutate('switch', { actorId: 'admin' }, rc)).status === 403,
);
ok(
  'requester cannot create accounts',
  (
    await mutate(
      'account-create',
      { login: 'spoof' + Date.now(), name: 'X', team: 'QA', role: 'admin', password: temp },
      rc,
    )
  ).status === 403,
);
ok(
  'requester cannot reset passwords',
  (await mutate('account-reset', { id, password: reset }, rc)).status === 403,
);
ok(
  'admin resets account password',
  (await mutate('account-reset', { id, password: reset })).status === 200,
);
ok(
  'old session revoked immediately',
  (await call('/api/workspace', { cookie: rc })).status === 401,
);
r = await call('/api/review-login', { body: { login, password: reset } });
ok('reset password requires setup again', r.status === 200 && r.data.next === '/setup-password');
r = await call('/api/password-setup', {
  cookie: r.cookie,
  body: { password: next + '2', confirm: next + '2' },
});
rc = r.cookie;
ok('password setup after reset succeeds', r.status === 200);
ok(
  'old password no longer authenticates',
  (await call('/api/review-login', { body: { login, password: next } })).status === 401,
);
ok(
  'cross origin write blocked',
  (
    await fetch(base + '/api/workspace', {
      method: 'POST',
      headers: { Cookie: ac, Origin: 'https://other.example', 'Content-Type': 'application/json' },
      body: '{}',
    })
  ).status === 403,
);
ok('anonymous workspace blocked', (await call('/api/workspace')).status === 401);
await call('/api/review-logout', { cookie: rc, body: {} });
ok('logout revokes issued session', (await call('/api/workspace', { cookie: rc })).status === 401);
console.log(n + ' account integration checks passed');
