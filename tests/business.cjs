const assert = require('node:assert/strict');
const { seed, stock, normalizeState } = require('./model.js');
const { act, visibleState } = require('./actions.js');
const { transform } = require('./automation.js');
let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log('PASS', name);
};
check('legacy brand labels normalize to Knowmerce', () => {
  const s = seed();
  s.products[0].category = '제품(노머스제작)';
  s.requests[0].inboundAttribute = '노머스로바로받음-노머스(회사)직접 받음';
  normalizeState(s);
  assert.equal(s.products[0].category, '제품(Knowmerce 제작)');
  assert.equal(s.requests[0].inboundAttribute, 'Knowmerce로 바로 받음 (회사 직접 수령)');
});
check('requester cannot edit, approve, complete or alter contracts', () => {
  for (const action of [
    'edit',
    'approve',
    'status',
    'contract',
    'product',
    'tariff',
    'automation',
  ]) {
    let s = seed();
    s.actorId = 'requester';
    assert.throws(
      () => act(s, action, { id: 'REQ-1028' }),
      (e) => e.status === 403,
    );
  }
});
check('requester can read shared projects but not logistics contract data', () => {
  let s = seed();
  s.actorId = 'requester';
  const x = visibleState(s);
  assert.equal(x.requests.length, s.requests.length);
  assert(x.requests.some((r) => r.owner === 'requester2'));
  assert.equal(x.contracts.length, 0);
  assert.equal(x.jobs.length, 0);
});
check('approval flags calendar source without changing inventory', () => {
  let s = seed(),
    before = stock(s, '300001');
  act(s, 'approve', { id: 'REQ-1028' });
  assert(s.requests.find((r) => r.id === 'REQ-1028').approved);
  assert.equal(stock(s, '300001'), before);
  assert(s.audits.some((a) => a.action === '프로젝트 승인'));
  assert.throws(() => act(s, 'approve', { id: 'REQ-1028' }));
});
check('change request remains pending until approval; schedule changes together', () => {
  let s = seed();
  s.actorId = 'requester';
  const r = s.requests.find((r) => r.id === 'REQ-1028');
  const d = { ...r };
  act(s, 'change', { id: r.id, qty: 350, date: '2026-11-02', reason: '배송 일정 변경' });
  assert.equal(r.qty, d.qty);
  s.actorId = 'staff';
  act(s, 'review-change', { id: s.changes[0].id, approve: true });
  assert.equal(r.qty, 350);
  assert.equal(r.date, '2026-11-02');
  assert.equal(s.changes[0].status, '승인');
});
check('stale modifications cannot overwrite current values', () => {
  let s = seed();
  const c = s.changes[0];
  s.requests.find((r) => r.id === c.requestId).version++;
  assert.throws(
    () => act(s, 'review-change', { id: c.id, approve: true }),
    (e) => e.status === 409,
  );
});
check('completion adjusts stock once and preserves movement history', () => {
  let s = seed();
  const before = stock(s, '300001');
  act(s, 'approve', { id: 'REQ-1028' });
  act(s, 'status', { id: 'REQ-1028', status: '배송 중' });
  act(s, 'status', { id: 'REQ-1028', status: '출고 완료', actual: 300 });
  assert.equal(stock(s, '300001'), before - 300);
  assert.equal(s.movements.filter((m) => m.requestId === 'REQ-1028').length, 1);
  assert.throws(() => act(s, 'status', { id: 'REQ-1028', status: '출고 완료', actual: 300 }));
  assert.equal(stock(s, '300001'), before - 300);
});
check('insufficient stock cannot complete', () => {
  let s = seed();
  act(s, 'approve', { id: 'REQ-1028' });
  act(s, 'status', { id: 'REQ-1028', status: '배송 중' });
  assert.throws(() => act(s, 'status', { id: 'REQ-1028', status: '출고 완료', actual: 99999 }));
  assert.equal(s.requests.find((r) => r.id === 'REQ-1028').status, '배송 중');
});
check('contract versions and before/after audit are saved', () => {
  let s = seed();
  act(s, 'contract', { ...s.contracts[0], base: 2400, reason: '단가 조정' });
  assert.equal(s.contracts[0].version, 2);
  assert(s.audits[0].before.includes('2300'));
  assert(s.audits[0].after.includes('2400'));
  s.actorId = 'staff';
  assert.throws(
    () => act(s, 'contract', { id: 'a' }),
    (e) => e.status === 403,
  );
});
check('missing fields prevent request creation', () => {
  let s = seed();
  const n = s.requests.length;
  assert.throws(() => act(s, 'create', { project: '', type: '출고' }));
  assert.equal(s.requests.length, n);
});
check('album duplicates deduct twice and preserve post-deduction quantities', () => {
  let s = seed();
  const result = transform(s, {
    mode: 'album',
    boxLimit: 20,
    rows: [{ order: 'ORDER', sku: '300001', qty: 42, country: 'KR' }],
    winners: [{ order: 'ORDER' }, { order: 'ORDER' }],
  });
  assert.equal(result.deducted, 2);
  assert.equal(result.qty, 40);
  assert.equal(result.boxCount, 2);
  for (const b of result.boxes) assert(b.qty <= 20);
});
check('unmatched or excessive winners block the run', () => {
  for (const winners of [[{ order: 'MISSING' }], [{ order: 'ONE' }, { order: 'ONE' }]]) {
    assert.throws(() =>
      transform(seed(), {
        mode: 'album',
        boxLimit: 20,
        rows: [{ order: 'ONE', sku: '300001', qty: 1, country: 'KR' }],
        winners,
      }),
    );
  }
});
check('album winner additions add selected option rows to the existing order box', () => {
  const result = transform(seed(), {
    mode: 'album',
    boxLimit: 20,
    targetSku: '300001',
    variants: ['300001', '300002', '300003'],
    rows: [
      {
        order: 'WIN-1',
        sku: '300001',
        qty: 3,
        country: 'KR',
        recipient: 'A',
        phone: '010-1111-1111',
        address: 'Street',
      },
    ],
    winners: [
      { order: 'WIN-1', option: '당첨자' },
      { order: 'WIN-1', option: '팬싸인회' },
    ],
    winnerAddition: {
      enabled: true,
      options: ['팬싸인회'],
      sku: '300099',
      name: '추가 앨범',
      unitQty: 1,
      unitPrice: 1,
      chargeWeight: 550,
    },
  });
  assert.equal(result.deducted, 2);
  assert.equal(result.addedQty, 1);
  assert.equal(result.qty, 2);
  assert.equal(result.winnerAdditionRows.length, 1);
  assert.equal(result.winnerAdditionRows[0].options, '팬싸인회');
  assert.equal(result.winnerAdditionRows[0].box, 'WIN-1-1');
  assert.equal(result.rows.find((r) => r.winnerAddition).qty, 1);
});
check('MD mixed packing respects capacity and quantities', () => {
  let s = seed();
  const result = transform(s, {
    mode: 'md',
    rows: [
      { order: 'MD', sku: '500101', qty: 8, country: 'KR' },
      { order: 'MD', sku: '500102', qty: 6, country: 'KR' },
    ],
  });
  assert.equal(result.qty, 14);
  assert.equal(result.boxCount, 2);
  for (const b of result.boxes) {
    let cap = result.rows
      .filter((r) => r.order === b.order)
      .reduce((n, r) => n + (15000 / s.products.find((p) => p.sku === r.sku).capacity) * r.qty, 0);
    assert(cap <= 15000.001);
  }
});
check('missing tariffs remain incomplete, never recommended as zero cost', () => {
  const result = transform(seed(), {
    mode: 'md',
    rows: [{ order: 'T', sku: '500101', qty: 3, country: 'ZZ' }],
  });
  assert.equal(result.cost.complete, false);
  assert.equal(result.boxes[0].a, null);
  assert(result.warnings.length > 0);
});
check('recurring preparation prevents duplicates and notice retry is explicit', () => {
  let s = seed();
  act(s, 'recurring-run', { id: 'REC-01' });
  assert.throws(() => act(s, 'recurring-run', { id: 'REC-01' }));
  const n = s.notices[0];
  act(s, 'retry-notice', { id: n.id });
  assert.equal(n.attempts, 1);
  assert(n.status.includes('미연결'));
});
console.log(passed + ' business and authorization checks passed');
const { inventoryStock, inventoryStatus } = require('./model.js');
check('requester batch issuance records actor and unknown inventory', () => {
  const s = seed();
  s.actorId = 'requester';
  const n = s.products.length;
  act(s, 'issue-codes', {
    ownership: '자사',
    project: '신규 MD',
    items: [
      { name: '새 상품 A', barcode: '0012345', category: '제품(Knowmerce 제작)' },
      { name: '새 상품 B', barcode: '', category: '증정(포카/지류/증정품)' },
      { name: '', barcode: '', category: '' },
    ],
  });
  const rows = s.products.slice(n);
  assert.deepEqual(
    rows.map((p) => p.sku),
    ['300004', '300005'],
  );
  assert(rows.every((p) => p.createdBy === 'requester' && p.ownership === '자사'));
  assert.equal(rows[0].barcode, '0012345');
  assert.equal(inventoryStock(s, rows[0].sku), null);
  assert.equal(inventoryStatus(inventoryStock(s, rows[0].sku)), '입고전');
  assert.equal(rows[1].capacity, 15000);
});
check('other ownership uses independent ascending range', () => {
  const s = seed();
  act(s, 'issue-codes', {
    ownership: '타사',
    project: '대행 MD',
    items: [{ name: '타사 상품', category: '대행(Knowmerce 비용 제외)' }],
  });
  assert.equal(s.products.at(-1).sku, '500106');
});
check('empty ranges start exactly at 300000 and 500000', () => {
  for (const [ownership, expected] of [
    ['자사', '300000'],
    ['타사', '500000'],
  ]) {
    const s = seed();
    s.products = [];
    act(s, 'issue-codes', {
      ownership,
      project: '최초 발번',
      items: [{ name: '첫 상품', category: '상품(완제품사입)' }],
    });
    assert.equal(s.products[0].sku, expected);
  }
});
check('multiple issuance operations never reuse previous SKU', () => {
  const s = seed();
  for (let i = 0; i < 3; i++)
    act(s, 'issue-codes', {
      ownership: '자사',
      project: '반복 발번',
      items: [{ name: '새 상품 ' + i, category: '제품(Knowmerce 제작)' }],
    });
  assert.deepEqual(
    s.products.slice(-3).map((p) => p.sku),
    ['300004', '300005', '300006'],
  );
  assert.equal(new Set(s.products.map((p) => p.sku)).size, s.products.length);
});
check('partial invalid batch does not create any products or audits', () => {
  const s = seed(),
    n = s.products.length,
    a = s.audits.length;
  assert.throws(() =>
    act(s, 'issue-codes', {
      ownership: '자사',
      project: '오류 확인',
      items: [
        { name: '정상 행', category: '제품(Knowmerce 제작)' },
        { name: '미완성 행', category: '' },
      ],
    }),
  );
  assert.equal(s.products.length, n);
  assert.equal(s.audits.length, a);
});
check('blank batch, invalid ownership and oversized batch are rejected', () => {
  for (const data of [
    { ownership: '자사', project: 'P', items: [{ name: '', barcode: '', category: '' }] },
    { ownership: '기타', project: 'P', items: [{ name: 'A', category: '제품(Knowmerce 제작)' }] },
    {
      ownership: '자사',
      project: 'P',
      items: Array.from({ length: 51 }, () => ({ name: 'A', category: '제품(Knowmerce 제작)' })),
    },
  ])
    assert.throws(() => act(seed(), 'issue-codes', data));
});
check('null and confirmed zero stock remain different values and colors', () => {
  const s = seed();
  s.products.push({ ...s.products[0], sku: '300099', name: '신규' });
  assert.equal(inventoryStock(s, '300099'), null);
  assert.equal(inventoryStatus(null), '입고전');
  s.movements.push({
    id: 'ZERO',
    sku: '300099',
    qty: 0,
    type: '기초 재고',
    project: 'P',
    requestId: '-',
    actor: 'staff',
    at: '',
    memo: '확인된 0',
  });
  assert.equal(inventoryStock(s, '300099'), 0);
  assert.equal(inventoryStatus(0), '품절');
  assert.equal(inventoryStatus(1), '정상');
});
check('unknown stock cannot be completed as outbound even at zero', () => {
  const s = seed();
  act(s, 'issue-codes', {
    ownership: '자사',
    project: '신규',
    items: [{ name: '미입고 상품', category: '제품(Knowmerce 제작)' }],
  });
  const sku = s.products.at(-1).sku;
  act(s, 'create', {
    confirmStock: true,
    project: '검증',
    type: '출고',
    sku,
    qty: 1,
    date: '2026-11-01',
    recipient: '가상',
    phone: '010-0000-0000',
    address: '예시 주소',
  });
  const r = s.requests[0];
  act(s, 'approve', { id: r.id });
  act(s, 'status', { id: r.id, status: '배송 중' });
  assert.throws(() => act(s, 'status', { id: r.id, status: '출고 완료', actual: 0 }));
  assert.equal(inventoryStock(s, sku), null);
});
console.log(passed + ' total checks passed');
const draftData = {
  project: '검증용 물류 요청',
  type: '입고',
  date: '2026-11-02',
  method: '퀵/박스',
  items: [
    { sku: '300001', qty: 3 },
    { sku: '300002', qty: 7 },
    { sku: '', qty: '', barcode: '' },
  ],
  note: '시험 요청',
  time: '13:30',
  transport: '예시 차량',
  country: 'JP',
  reason: '신규 입고',
};
check('save is a multi-product draft; only request creates notification', () => {
  const s = seed();
  s.actorId = 'requester';
  const n = s.notices.length;
  act(s, 'save-draft', draftData);
  const r = s.requests[0];
  assert.equal(r.status, '입력완료');
  assert.equal(r.items.length, 2);
  assert.equal(r.qty, 10);
  assert.equal(s.notices.length, n);
  assert(!r.approved);
  s.actorId = 'staff';
  assert.throws(() => act(s, 'approve', { id: r.id }));
  s.actorId = 'requester';
  act(s, 'submit-draft', { id: r.id, version: r.version });
  assert.equal(r.status, '물류팀 확인 중');
  assert.equal(s.notices.length, n + 1);
  assert.throws(() => act(s, 'submit-draft', { id: r.id, version: r.version }));
  assert.throws(() => act(s, 'save-draft', { ...draftData, id: r.id, version: r.version }));
  assert.throws(() => act(s, 'delete-draft', { id: r.id, version: r.version }));
});
check('draft edit/delete check owner and revision and never reuse num', () => {
  const s = seed();
  s.actorId = 'requester';
  act(s, 'save-draft', draftData);
  const r = s.requests[0],
    num = r.num;
  s.actorId = 'requester2';
  for (const action of ['save-draft', 'submit-draft', 'delete-draft'])
    assert.throws(
      () => act(s, action, { ...draftData, id: r.id, version: r.version }),
      (e) => e.status === 403,
    );
  s.actorId = 'requester';
  assert.throws(
    () => act(s, 'save-draft', { ...draftData, id: r.id, version: 0 }),
    (e) => e.status === 409,
  );
  act(s, 'save-draft', {
    ...draftData,
    id: r.id,
    version: r.version,
    items: [{ sku: '300003', qty: 4 }],
  });
  assert.equal(r.qty, 4);
  assert.equal(r.items[0].sku, '300003');
  act(s, 'delete-draft', { id: r.id, version: r.version });
  assert(!s.requests.some((x) => x.id === r.id));
  act(s, 'save-draft', draftData);
  assert(s.requests[0].num > num);
  assert(s.audits.some((a) => a.action === '입력완료 삭제'));
});
check('all product lines must validate before saving and duplicate SKU is blocked', () => {
  for (const items of [
    [
      { sku: '300001', qty: 1 },
      { sku: '999999', qty: 1 },
    ],
    [
      { sku: '300001', qty: 1 },
      { sku: '300001', qty: 2 },
    ],
    [
      { sku: '300001', qty: 1 },
      { sku: '300002', qty: 0 },
    ],
    [],
  ]) {
    const s = seed(),
      before = JSON.stringify(s);
    assert.throws(() => act(s, 'save-draft', { ...draftData, items }));
    assert.equal(JSON.stringify(s), before);
  }
});
check('master determines project data and ignores spoofed product names', () => {
  const s = seed();
  act(s, 'save-draft', {
    ...draftData,
    items: [{ sku: '300001', qty: 2, name: '조작 이름', project: '조작 프로젝트' }],
  });
  assert.equal(s.requests[0].project, draftData.project);
  assert(!JSON.stringify(s.requests[0]).includes('조작'));
});
check('multi-product inbound completes once and changes stock for every SKU', () => {
  const s = seed(),
    a = stock(s, '300001'),
    b = stock(s, '300002');
  act(s, 'save-draft', draftData);
  const r = s.requests[0];
  act(s, 'submit-draft', { id: r.id, version: r.version });
  act(s, 'approve', { id: r.id });
  act(s, 'status', {
    id: r.id,
    status: '입고 완료',
    actuals: [
      { sku: '300001', actual: 2 },
      { sku: '300002', actual: 6 },
    ],
  });
  assert.equal(stock(s, '300001'), a + 2);
  assert.equal(stock(s, '300002'), b + 6);
  assert.equal(r.actual, 8);
  assert.equal(s.movements.filter((m) => m.requestId === r.id).length, 2);
  assert.throws(() =>
    act(s, 'status', {
      id: r.id,
      status: '입고 완료',
      actuals: [
        { sku: '300001', actual: 2 },
        { sku: '300002', actual: 6 },
      ],
    }),
  );
});
check('multi-product outbound validates every stock before any mutation', () => {
  const s = seed();
  act(s, 'save-draft', {
    ...draftData,
    type: '출고',
    reason: '판매(고객/회사등)',
    recipient: '데모',
    phone: '010-0000-0000',
    address: '예시주소',
  });
  const r = s.requests[0];
  act(s, 'submit-draft', { id: r.id, version: r.version });
  act(s, 'approve', { id: r.id });
  act(s, 'status', { id: r.id, status: '배송 중' });
  const before = JSON.stringify(s);
  assert.throws(() =>
    act(s, 'status', {
      id: r.id,
      status: '출고 완료',
      actuals: [
        { sku: '300001', actual: 1 },
        { sku: '300002', actual: 999999 },
      ],
    }),
  );
  assert.equal(JSON.stringify(s), before);
  assert.throws(() => act(s, 'status', { id: r.id, status: '출고 완료', actual: 1 }));
  assert.equal(JSON.stringify(s), before);
});
check('multi-product change approval retains quantities by SKU and date', () => {
  const s = seed();
  s.actorId = 'requester';
  act(s, 'save-draft', draftData);
  const r = s.requests[0];
  act(s, 'submit-draft', { id: r.id, version: r.version });
  act(s, 'change', {
    id: r.id,
    qty: 12,
    date: '2026-11-03',
    reason: '수량 변경',
    items: [
      { sku: '300001', qty: 5 },
      { sku: '300002', qty: 7 },
    ],
  });
  assert.equal(r.qty, 10);
  s.actorId = 'staff';
  act(s, 'review-change', { id: s.changes[0].id, approve: true });
  assert.equal(r.qty, 12);
  assert.equal(r.items[0].qty, 5);
  assert.equal(r.date, '2026-11-03');
});
check('issuance prefixes names, ignores unused rows and keeps batch timestamp stable', () => {
  const s = seed();
  act(s, 'issue-codes', {
    ownership: '자사',
    project: '새 프로젝트',
    items: [
      { name: '티셔츠', category: '제품(Knowmerce 제작)' },
      { name: '포카', category: '증정(포카/지류/증정품)' },
      { name: '', category: '', barcode: '' },
    ],
  });
  assert.equal(s.products.at(-2).name, '[새 프로젝트]_티셔츠');
  assert.equal(s.products.at(-1).name, '[새 프로젝트]_포카');
  assert.equal(s.products.at(-2).createdAt, s.products.at(-1).createdAt);
});
console.log(passed + ' final business checks passed');

const { calendarEvents, approvalMessage } = require('./model.js');
check('inbound method is optional while unsupported values are rejected', () => {
  const s = seed();
  act(s, 'save-draft', { ...draftData, method: '' });
  assert.equal(s.requests[0].method, '');
  assert.throws(() => act(s, 'save-draft', { ...draftData, method: '알수없음' }));
});
check('direct request saves and submits atomically with one notification', () => {
  const s = seed(),
    notices = s.notices.length;
  act(s, 'direct-request', { ...draftData, method: '' });
  const r = s.requests[0];
  assert.equal(r.status, '물류팀 확인 중');
  assert.equal(r.items.length, 2);
  assert.equal(s.notices.length, notices + 1);
  assert(!r.approved);
  assert.throws(() => act(s, 'save-draft', { ...draftData, id: r.id, version: r.version }));
  const before = JSON.stringify(s);
  assert.throws(() =>
    act(s, 'direct-request', { ...draftData, items: [{ sku: 'INVALID', qty: 1 }] }),
  );
  assert.equal(JSON.stringify(s), before);
});
check('approval enters discussion and prepares required Slack content without transport', () => {
  const s = seed();
  const r = s.requests.find((r) => r.id === 'REQ-1028');
  act(s, 'approve', { id: r.id });
  assert.equal(r.status, '슬랙 논의 중');
  const n = s.notices[0];
  assert(n.message.includes('요청자 : @박지우'));
  assert(n.message.includes('물류담당자 : @김민서'));
  assert(n.message.includes('시행 일시 : ' + r.date));
  assert(n.status.includes('Slack 대기'));
  assert.equal(n.message, approvalMessage(s, r));
  assert.throws(() => act(s, 'approve', { id: r.id }));
});
check('shared viewing excludes other requester drafts and protects their writes', () => {
  const s = seed();
  s.actorId = 'requester2';
  act(s, 'save-draft', draftData);
  const draft = s.requests[0];
  s.actorId = 'requester';
  const visible = visibleState(s);
  assert(!visible.requests.some((r) => r.id === draft.id));
  assert(visible.requests.some((r) => r.id === 'REQ-1027'));
  assert.throws(
    () => act(s, 'change', { id: 'REQ-1027', qty: 1, date: '2026-11-02', reason: '타인 변경' }),
    (e) => e.status === 403,
  );
  assert.throws(
    () => act(s, 'comment', { id: draft.id, body: '초안 열람' }),
    (e) => e.status === 403,
  );
});
check('all actors can leave attributed comments on submitted shared projects', () => {
  const s = seed(),
    r = s.requests.find((r) => r.id === 'REQ-1027'),
    v = r.version;
  for (const id of ['requester', 'requester2', 'staff', 'admin']) {
    s.actorId = id;
    act(s, 'comment', { id: r.id, body: id + ' 메모', actor: 'spoof' });
  }
  assert.deepEqual(
    r.comments.map((c) => c.actor),
    ['requester', 'requester2', 'staff', 'admin'],
  );
  assert.equal(r.version, v);
  assert.equal(r.comments.length, 4);
  assert.throws(() => act(s, 'comment', { id: r.id, body: '  ' }));
});
check('only admin reassigns logistics owner and server validates completion forecast', () => {
  const s = seed();
  const r = s.requests.find((r) => r.id === 'REQ-1028');
  s.actorId = 'staff';
  assert.throws(
    () =>
      act(s, 'manage-project', { id: r.id, version: r.version, assignee: 'admin', center: '패박' }),
    (e) => e.status === 403,
  );
  act(s, 'manage-project', {
    id: r.id,
    version: r.version,
    assignee: 'staff',
    center: '패박',
    expectedCompletion: '2026-12-02',
  });
  assert.equal(r.expectedCompletion, '2026-12-02');
  s.actorId = 'admin';
  act(s, 'manage-project', {
    id: r.id,
    version: r.version,
    assignee: 'admin',
    center: '다보내',
    expectedCompletion: '2026-12-03',
  });
  assert.equal(r.assignee, 'admin');
  assert.throws(() =>
    act(s, 'manage-project', { id: r.id, version: r.version, assignee: 'requester' }),
  );
  assert.throws(() =>
    act(s, 'manage-project', {
      id: r.id,
      version: r.version,
      assignee: 'admin',
      expectedCompletion: '2000-01-01',
    }),
  );
  s.actorId = 'requester';
  assert.throws(
    () => act(s, 'manage-project', { id: r.id, version: r.version }),
    (e) => e.status === 403,
  );
});
check('company calendar covers both providers, start and forecast, without duplicates', () => {
  const s = seed();
  const r = s.requests.find((r) => r.id === 'REQ-1028');
  r.approved = true;
  r.center = '패박';
  r.expectedCompletion = '2026-12-01';
  const events = calendarEvents(s).filter((e) => e.request.id === r.id);
  assert.equal(events.length, 2);
  assert(events.some((e) => e.date === r.date && e.center === '패박'));
  assert(events.some((e) => e.date === '2026-12-01' && e.kind === '출고 완료예정'));
  r.expectedCompletion = r.date;
  assert.equal(calendarEvents(s).filter((e) => e.request.id === r.id).length, 1);
  s.actorId = 'requester';
  assert(calendarEvents(visibleState(s)).some((e) => e.request.owner === 'requester2'));
});
check('admin may change active stages but completion still enforces stock and stays final', () => {
  const s = seed(),
    r = s.requests.find((r) => r.id === 'REQ-1028');
  act(s, 'approve', { id: r.id });
  act(s, 'status', { id: r.id, status: '출고중' });
  act(s, 'status', { id: r.id, status: '물류팀 확인 중' });
  const before = stock(s, r.sku);
  act(s, 'status', { id: r.id, status: '출고 완료', actual: 1 });
  assert.equal(stock(s, r.sku), before - 1);
  assert.throws(() => act(s, 'status', { id: r.id, status: '배송 중' }));
});
console.log(passed + ' final checks passed');

const { periods, weekSegments } = require('./calendar.js');
check('logistics request name is mandatory and zero quantity reports physical row', () => {
  const s = seed();
  assert.throws(() => act(s, 'save-draft', { ...draftData, project: ' ' }), /물류 요청 이름/);
  assert.throws(
    () =>
      act(s, 'save-draft', {
        ...draftData,
        items: [
          { sku: '', qty: '' },
          { sku: '300001', qty: 0 },
        ],
      }),
    /2행의 수량을 확인해주세요/,
  );
  assert.throws(
    () => act(s, 'direct-request', { ...draftData, items: [{ sku: '300001', qty: 0 }] }),
    /1행의 수량을 확인해주세요/,
  );
});
check('staff can edit inventory with stock delta and complete before-after audit', () => {
  const s = seed();
  s.actorId = 'staff';
  const p = s.products[0],
    old = stock(s, p.sku),
    count = s.movements.length;
  act(s, 'inventory', {
    sku: p.sku,
    barcode: '000123',
    category: '제품(Knowmerce 제작)',
    center: '패스트박스 · 김포',
    qty: old - 10,
    reason: '현장 실사',
  });
  assert.equal(stock(s, p.sku), old - 10);
  assert.equal(s.movements.length, count + 1);
  assert.equal(s.movements.at(-1).qty, -10);
  assert(s.audits[0].before.includes(String(old)));
  assert(s.audits[0].after.includes('현장 실사'));
  assert.equal(s.audits[0].actor, 'staff');
  assert.equal(p.barcode, '000123');
  assert.equal(p.center, '패스트박스 · 김포');
  act(s, 'inventory', {
    sku: p.sku,
    barcode: '',
    category: p.category,
    center: p.center,
    qty: old - 10,
    reason: '바코드 제외',
  });
  assert.equal(s.movements.length, count + 1);
});
check('inventory edits require staff and reason; validation cannot partially mutate', () => {
  for (const data of [
    { qty: -1, reason: '오류' },
    { qty: 1.5, reason: '오류' },
    { qty: 1, reason: '' },
    { qty: null, reason: '오류' },
  ]) {
    const s = seed(),
      before = JSON.stringify(s);
    assert.throws(() =>
      act(s, 'inventory', {
        sku: '300001',
        barcode: 'B',
        category: '앨범',
        center: '다보내',
        ...data,
      }),
    );
    assert.equal(JSON.stringify(s), before);
  }
  const s = seed();
  s.actorId = 'requester';
  assert.throws(
    () => act(s, 'inventory', { sku: '300001' }),
    (e) => e.status === 403,
  );
});
check('unknown inventory can remain unknown or become confirmed zero explicitly', () => {
  const s = seed();
  act(s, 'issue-codes', {
    ownership: '자사',
    project: 'P',
    items: [{ name: 'A', category: '제품(Knowmerce 제작)' }],
  });
  const p = s.products.at(-1);
  act(s, 'inventory', {
    sku: p.sku,
    barcode: '',
    category: p.category,
    center: '미배정',
    qty: '',
    reason: '속성 확인',
  });
  assert.equal(inventoryStock(s, p.sku), null);
  act(s, 'inventory', {
    sku: p.sku,
    barcode: '',
    category: p.category,
    center: '미배정',
    qty: 0,
    reason: '재고 확인',
  });
  assert.equal(inventoryStock(s, p.sku), 0);
});
check('duration spans week boundaries and overlapping tasks get separate rows', () => {
  const s = seed(),
    r = s.requests.find((r) => r.id === 'REQ-1027');
  r.center = '패박';
  r.date = '2026-10-30';
  r.expectedCompletion = '2026-11-04';
  const other = { ...r, id: 'OVERLAP', date: '2026-10-31', expectedCompletion: '2026-11-02' };
  s.requests.push(other);
  const all = periods(s);
  const left = weekSegments(all, '2026-10-25', '패박', '출고').filter((x) =>
    [r.id, other.id].includes(x.request.id),
  );
  assert.equal(left.length, 2);
  assert.equal(left[0].from, 5);
  assert.equal(left[0].span, 2);
  assert(left[0].continuesAfter);
  assert.notEqual(left[0].row, left[1].row);
  const right = weekSegments(all, '2026-11-01', '패박', '출고').find((x) => x.request.id === r.id);
  assert.equal(right.from, 0);
  assert.equal(right.span, 4);
  assert(right.continuesBefore);
});
check('inbound can also define a planned duration without moving inventory', () => {
  const s = seed(),
    r = s.requests.find((r) => r.id === 'REQ-1026'),
    before = stock(s, r.sku);
  act(s, 'manage-project', {
    id: r.id,
    version: r.version,
    assignee: r.assignee,
    center: '다보내',
    expectedCompletion: '2026-12-01',
  });
  const p = periods(s).find((p) => p.request.id === r.id);
  assert.equal(p.end, '2026-12-01');
  assert.equal(stock(s, r.sku), before);
});
console.log(passed + ' final checks passed');

const { inboundAttributes, outboundReasons } = require('./model.js');
check('inbound routing attribute persists independently from SKU category', () => {
  for (const inboundAttribute of inboundAttributes) {
    const s = seed();
    act(s, 'save-draft', { ...draftData, inboundAttribute });
    assert.equal(s.requests[0].inboundAttribute, inboundAttribute);
    assert.equal(s.products[0].category, '앨범');
  }
  assert.throws(() => act(seed(), 'save-draft', { ...draftData, inboundAttribute: '알수없음' }));
});
check('outbound has nine controlled reasons and requires no method', () => {
  assert.equal(outboundReasons.length, 9);
  for (const reason of outboundReasons) {
    const s = seed();
    act(s, 'direct-request', {
      ...draftData,
      type: '출고',
      method: '',
      reason,
      recipient: '예시',
      phone: '010-0000-0000',
      address: '예시주소',
    });
    assert.equal(s.requests[0].reason, reason);
    assert.equal(s.requests[0].method, '');
  }
  for (const reason of ['', '잘못된 사유'])
    assert.throws(() =>
      act(seed(), 'save-draft', {
        ...draftData,
        type: '출고',
        reason,
        recipient: '예시',
        phone: '010-0000-0000',
        address: '예시주소',
      }),
    );
});
check('legacy submitted requests retain original reason during quantity changes', () => {
  const s = seed(),
    r = s.requests.find((r) => r.id === 'REQ-1028');
  r.reason = '이전 자유 입력 사유';
  s.actorId = 'requester';
  act(s, 'change', {
    id: r.id,
    qty: 5,
    date: r.date,
    reason: '수량 수정',
    items: [{ sku: r.sku, qty: 5 }],
  });
  assert.equal(r.reason, '이전 자유 입력 사유');
  assert.equal(s.changes[0].items[0].qty, 5);
});
console.log(passed + ' final checks passed');

const { matchesRequestFilter, outboundShortages } = require('./model.js');
check(
  'dashboard and tabs filter approval, discussion, completed and change requests precisely',
  () => {
    const s = seed();
    assert.equal(s.requests.filter((r) => matchesRequestFilter(s, r, '승인대기')).length, 1);
    assert.equal(s.requests.filter((r) => matchesRequestFilter(s, r, '슬랙 논의 중')).length, 1);
    assert.equal(s.requests.filter((r) => matchesRequestFilter(s, r, '완료')).length, 2);
    assert.equal(s.requests.filter((r) => matchesRequestFilter(s, r, '수정 요청')).length, 1);
  },
);
check(
  'only staff edit submitted request lines to zero; requester and new requests still require positive quantities',
  () => {
    const s = seed();
    act(s, 'direct-request', draftData);
    const r = s.requests[0];
    s.actorId = 'staff';
    act(s, 'edit', {
      id: r.id,
      version: r.version,
      items: [
        { sku: '300001', qty: 0 },
        { sku: '300002', qty: 7 },
      ],
    });
    assert.equal(r.items[0].qty, 0);
    assert.equal(r.qty, 7);
    assert.throws(() =>
      act(s, 'edit', { id: r.id, version: r.version, items: [{ sku: '300001', qty: '' }] }),
    );
    s.actorId = 'requester';
    assert.throws(
      () => act(s, 'edit', { id: r.id, version: r.version, qty: 0 }),
      (e) => e.status === 403,
    );
    assert.throws(() =>
      act(s, 'direct-request', { ...draftData, items: [{ sku: '300001', qty: 0 }] }),
    );
  },
);
check(
  'confirmed cancellation is terminal, removes calendar entries and voids pending changes without touching stock',
  () => {
    const s = seed(),
      r = s.requests.find((r) => r.id === 'REQ-1027'),
      before = JSON.stringify(s.movements);
    assert.throws(() => act(s, 'status', { id: r.id, status: '취소', version: r.version }));
    assert.throws(
      () => act(s, 'status', { id: r.id, status: '취소', confirmCancel: true, version: 0 }),
      (e) => e.status === 409,
    );
    s.actorId = 'requester';
    assert.throws(
      () => act(s, 'status', { id: r.id, status: '취소', confirmCancel: true, version: r.version }),
      (e) => e.status === 403,
    );
    s.actorId = 'staff';
    act(s, 'status', { id: r.id, status: '취소', confirmCancel: true, version: r.version });
    assert.equal(r.status, '취소');
    assert.equal(s.changes[0].status, '취소');
    assert.equal(JSON.stringify(s.movements), before);
    assert(!calendarEvents(s).some((e) => e.request.id === r.id));
    assert(!periods(s).some((e) => e.request.id === r.id));
    s.actorId = 'admin';
    assert.throws(() => act(s, 'status', { id: r.id, status: '배송 중' }));
    assert.throws(() => act(s, 'approve', { id: r.id }));
  },
);
check(
  'stock shortage requires acknowledgment on request but drafts can be saved; inbound replenishment enables actual completion',
  () => {
    const s = seed();
    s.actorId = 'requester';
    const data = {
      ...draftData,
      type: '출고',
      reason: '판매(고객/회사등)',
      recipient: '데모',
      phone: '010-0000-0000',
      address: '예시주소',
      items: [{ sku: '300001', qty: 1700 }],
    };
    act(s, 'save-draft', data);
    const r = s.requests[0];
    assert(outboundShortages(s, r).length);
    const before = JSON.stringify(s);
    assert.throws(() => act(s, 'submit-draft', { id: r.id, version: r.version }), /그래도 요청/);
    assert.equal(JSON.stringify(s), before);
    act(s, 'submit-draft', { id: r.id, version: r.version, confirmStock: true });
    s.actorId = 'staff';
    act(s, 'approve', { id: r.id });
    act(s, 'status', { id: r.id, status: '배송 중' });
    assert.throws(
      () => act(s, 'status', { id: r.id, status: '출고 완료', actual: 1700 }),
      /재고가 부족/,
    );
    s.movements.push({
      id: 'INCOMING',
      sku: '300001',
      qty: 200,
      type: '입고',
      project: '보충',
      requestId: 'OTHER',
      actor: 'staff',
      at: '',
      memo: '',
    });
    act(s, 'status', { id: r.id, status: '출고 완료', actual: 1700 });
    assert.equal(stock(s, '300001'), 100);
  },
);
console.log(passed + ' checks passed');

check(
  'zeroed unshipped item can complete without making unknown inventory a confirmed zero',
  () => {
    const s = seed();
    s.actorId = 'staff';
    act(s, 'issue-codes', {
      ownership: '자사',
      project: '미입고',
      items: [{ name: '보류 상품', category: '제품(Knowmerce 제작)' }],
    });
    const sku = s.products.at(-1).sku;
    act(s, 'direct-request', {
      ...draftData,
      type: '출고',
      reason: '판매(고객/회사등)',
      recipient: '예시',
      phone: '010-0000-0000',
      address: '예시주소',
      confirmStock: true,
      items: [
        { sku: '300001', qty: 2 },
        { sku, qty: 1 },
      ],
    });
    const r = s.requests[0];
    act(s, 'edit', {
      id: r.id,
      version: r.version,
      items: [
        { sku: '300001', qty: 2 },
        { sku, qty: 0 },
      ],
    });
    act(s, 'approve', { id: r.id });
    act(s, 'status', { id: r.id, status: '배송 중' });
    act(s, 'status', {
      id: r.id,
      status: '출고 완료',
      actuals: [
        { sku: '300001', actual: 2 },
        { sku, actual: 0 },
      ],
    });
    assert.equal(r.actual, 2);
    assert.equal(inventoryStock(s, sku), null);
    assert.equal(s.movements.filter((m) => m.requestId === r.id).length, 1);
  },
);
console.log(passed + ' final checks passed');

const { parseOrderCSV, outputRows, csvText, mdExample } = require('./order-files.js');
check(
  'MD sample splits mixed orders, reconciles quantities and estimates both carriers exactly',
  () => {
    const s = seed(),
      settings = {
        500101: { name: '티셔츠', capacity: 10, chargeWeight: 300 },
        500102: { name: '에코백', capacity: 15, chargeWeight: 200 },
      };
    const r = transform(s, { mode: 'md', rows: mdExample(), productSettings: settings });
    assert.equal(r.boxCount, 4);
    assert.equal(r.qty, 20);
    assert.equal(r.rows.length, 6);
    assert(r.boxes.every((b) => b.volume <= 15000.00001));
    assert.equal(r.cost.a, 64750);
    assert.equal(r.cost.b, 61960);
    assert.equal(r.cost.domestic.boxes, 2);
    assert.equal(r.cost.international.boxes, 2);
    assert(r.cost.complete);
    assert(r.reconciliation.balanced);
    assert(r.issues.length === 0);
    assert.equal(s.products.find((p) => p.sku === '500101').chargeWeight, 1200);
    assert.equal(r.basis.products.find((p) => p.sku === '500101').chargeWeight, 300);
  },
);
check('CSV preserves original columns and leading zeros while normalizing domestic phone', () => {
  const rows = parseOrderCSV(
    '주문번호,재고코드,상품명,수량,국가코드,받는사람,전화번호,우편번호,주소,상세주소,추가메모\n001,500101,티셔츠,2,kr,예시,01012345678,01234,"서울, 예시",2층,"메모\n두 줄"',
  );
  assert.equal(rows[0].order, '001');
  assert.equal(rows[0].phone, '010-1234-5678');
  assert.equal(rows[0].postal, '01234');
  assert.equal(rows[0].source.추가메모, '메모\n두 줄');
  assert.equal(rows[0].country, 'KR');
  const r = transform(seed(), { mode: 'md', rows });
  const out = outputRows(r.rows);
  assert.equal(out[0].추가메모, '메모\n두 줄');
  assert.equal(out[0].주소, '서울, 예시');
  assert.equal(out[0].상세주소, '2층');
  assert.equal(out[0].전화번호, '010-1234-5678');
  assert(csvText(out).startsWith('\uFEFF'));
  assert.throws(() => parseOrderCSV('주문번호,주문번호\na,b'), /중복/);
  assert.throws(() => parseOrderCSV('주문번호,재고코드,수량,국가코드\n"OPEN'), /따옴표/);
});
check(
  'missing country and inconsistent recipients never silently merge into domestic boxes',
  () => {
    assert.throws(
      () => transform(seed(), { mode: 'md', rows: [{ order: 'X', sku: '500101', qty: 1 }] }),
      /국가코드/,
    );
    assert.throws(
      () =>
        transform(seed(), {
          mode: 'md',
          rows: [
            { order: 'X', sku: '500101', qty: 1, country: 'KR', address: 'A' },
            { order: 'X', sku: '500102', qty: 1, country: 'JP', address: 'B' },
          ],
        }),
      /같은 주문번호/,
    );
  },
);
check('unregistered MD uses validated per-job settings without changing inventory master', () => {
  const s = seed(),
    before = JSON.stringify(s.products);
  const rows = [{ order: 'NEW', sku: 'NEW-MD', name: '새 MD', qty: 3, country: 'KR' }];
  assert.throws(() => transform(s, { mode: 'md', rows }), /등록되지 않은 품번/);
  const r = transform(s, {
    mode: 'md',
    rows,
    productSettings: { 'NEW-MD': { name: '새 MD', capacity: 2, chargeWeight: 100 } },
  });
  assert.equal(r.boxCount, 2);
  assert.equal(r.qty, 3);
  assert.equal(JSON.stringify(s.products), before);
  assert.throws(
    () =>
      transform(s, {
        mode: 'md',
        rows,
        productSettings: { 'NEW-MD': { name: '새 MD', capacity: 2, chargeWeight: 0 } },
      }),
    /청구무게/,
  );
});
check(
  'cancelled rows are excluded explicitly and packing keys cannot collide with object prototypes',
  () => {
    const r = transform(seed(), {
      mode: 'md',
      rows: [
        { order: '__proto__', sku: '500101', qty: 2, country: 'KR' },
        { order: 'constructor', sku: '500102', qty: 1, country: 'KR' },
        { order: 'CANCELLED', sku: '500102', qty: 7, country: 'KR', shippingStatus: 'cancelled' },
      ],
    });
    assert.equal(r.boxCount, 2);
    assert.equal(r.qty, 3);
    assert.equal(r.reconciliation.excludedQty, 7);
    assert.equal(r.reconciliation.excludedRows, 1);
    assert.equal(r.reconciliation.originalQty, 10);
  },
);
check('album mixed items keep distinct box IDs and invalid album mappings are blocked', () => {
  const s = seed(),
    r = transform(s, {
      mode: 'album',
      boxLimit: 20,
      capacities: { 500101: 1 },
      rows: [
        { order: 'MIX', sku: '300001', qty: 1, country: 'KR' },
        { order: 'MIX', sku: '500101', qty: 3, country: 'KR' },
      ],
    });
  assert.equal(r.boxCount, 4);
  assert.equal(new Set(r.rows.map((r) => r.order)).size, 4);
  assert.equal(r.qty, 4);
  assert.throws(
    () =>
      transform(s, {
        mode: 'album',
        boxLimit: 20,
        variants: ['300001', '500101'],
        rows: [{ order: 'X', sku: '300001', qty: 2, country: 'KR' }],
      }),
    /앨범 버전/,
  );
});
check('incomplete tariffs stay null per box and snapshots survive later master edits', () => {
  const s = seed(),
    r = transform(s, { mode: 'md', rows: [{ order: 'X', sku: '500101', qty: 1, country: 'ZZ' }] });
  assert.equal(r.boxes[0].a, null);
  assert.equal(r.cost.complete, false);
  const base = r.basis.contracts[0].base;
  s.contracts[0].base += 500;
  assert.equal(r.basis.contracts[0].base, base);
});
console.log(passed + ' final checks passed');

const publicDemo = require('./public-demo.js');
const originalDemo = publicDemo.newPublicDemo();
assert.equal(publicDemo.readPublicDemo('{broken').actorId, 'admin');
const switchedDemo = publicDemo.applyPublicDemo(originalDemo, 'switch', { actorId: 'staff' });
assert.equal(switchedDemo.actorId, 'staff');
assert.equal(originalDemo.actorId, 'admin');
assert.throws(() => publicDemo.applyPublicDemo(originalDemo, 'account-create', {}));
assert.throws(() => publicDemo.applyPublicDemo(originalDemo, 'account-reset', {}));
console.log('PASS public demo has isolated state, role switching and no real account mutations');
