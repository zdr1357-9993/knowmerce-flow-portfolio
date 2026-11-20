export type Role = 'requester' | 'staff' | 'admin';
export type Actor = {
  id: string;
  name: string;
  role: Role;
  team: string;
  login?: string;
  mustReset?: boolean;
};
export type Product = {
  sku: string;
  name: string;
  project: string;
  category: string;
  center: string;
  capacity: number;
  chargeWeight: number;
  threshold: number;
  ownership?: '자사' | '타사';
  barcode?: string;
  createdBy?: string;
  createdAt?: string;
  isGift?: boolean;
};
export type RequestLine = { sku: string; qty: number; barcode?: string; actual?: number };
export type ProjectComment = { id: string; actor: string; at: string; body: string };
export type RequestItem = {
  inboundAttribute?: string;
  center?: string;
  expectedCompletion?: string;
  comments?: ProjectComment[];
  num?: number;
  items?: RequestLine[];
  method?: string;
  time?: string;
  transport?: string;
  country?: string;
  reason?: string;
  id: string;
  project: string;
  type: '입고' | '출고';
  sku: string;
  qty: number;
  actual?: number;
  date: string;
  owner: string;
  assignee: string;
  status: string;
  approved: boolean;
  note: string;
  recipient: string;
  phone: string;
  address: string;
  version: number;
  createdAt: string;
};
export type Audit = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  before: string;
  after: string;
};
export type Change = {
  items?: RequestLine[];
  id: string;
  requestId: string;
  owner: string;
  qty: number;
  date: string;
  reason: string;
  status: string;
  baseVersion: number;
  createdAt: string;
};
export type Movement = {
  id: string;
  sku: string;
  qty: number;
  type: string;
  project: string;
  requestId: string;
  actor: string;
  at: string;
  memo: string;
};
export type Contract = {
  id: string;
  name: string;
  base: number;
  labor: number;
  overseasLabor: number;
  material: number;
  free: number;
  extra: number;
  cap: number;
  version: number;
};
export type Tariff = { country: string; weight: number; a: number; b: number };
export type Notice = {
  id: string;
  at: string;
  title: string;
  message: string;
  target: string;
  status: string;
  attempts: number;
};
export type Job = {
  id: string;
  at: string;
  mode: string;
  project: string;
  input: any;
  result: any;
  revision: number;
  parent?: string;
};
export type Recurring = {
  id: string;
  name: string;
  supplier: string;
  weekday: string;
  skus: string[];
  enabled: boolean;
  lastRun?: string;
};
export type State = {
  nextRequestNum?: number;
  actors: Actor[];
  actorId: string;
  products: Product[];
  requests: RequestItem[];
  changes: Change[];
  movements: Movement[];
  audits: Audit[];
  contracts: Contract[];
  tariffs: Tariff[];
  notices: Notice[];
  jobs: Job[];
  recurring: Recurring[];
};
export const roleLabel: Record<Role, string> = {
  requester: '요청자',
  staff: '물류 담당자',
  admin: '물류 어드민',
};
export const iso = () => new Date().toISOString();
export function today() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
export function offsetDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
export const uid = (prefix = '') => prefix + crypto.randomUUID().slice(0, 8).toUpperCase();
export const productCategories = [
  '상품(완제품사입)',
  '제품(Knowmerce 제작)',
  '증정(포카/지류/증정품)',
  '대행(Knowmerce 비용 제외)',
] as const;
export const inventoryStock = (s: State, sku: string): number | null =>
  s.movements.some((m) => m.sku === sku) ? stock(s, sku) : null;
export const inventoryStatus = (qty: number | null) =>
  qty === null ? '입고전' : qty === 0 ? '품절' : '정상';
export const stock = (s: State, sku: string) =>
  s.movements.filter((x) => x.sku === sku).reduce((a, b) => a + b.qty, 0);
export function seed(): State {
  const actors: Actor[] = [
    { id: 'admin', name: '이서준', role: 'admin', team: '물류 운영팀' },
    { id: 'staff', name: '김민서', role: 'staff', team: '물류 운영팀' },
    { id: 'requester', name: '박지우', role: 'requester', team: '상품기획팀' },
    { id: 'requester2', name: '정하린', role: 'requester', team: '콘텐츠 운영팀' },
  ];
  const products: Product[] = [
    {
      sku: '300001',
      name: 'GOLDEN HOUR 앨범 · A ver.',
      project: 'ATEEZ GOLDEN HOUR',
      category: '앨범',
      center: '다보내 · 이천',
      capacity: 20,
      chargeWeight: 550,
      threshold: 200,
    },
    {
      sku: '300002',
      name: 'GOLDEN HOUR 앨범 · B ver.',
      project: 'ATEEZ GOLDEN HOUR',
      category: '앨범',
      center: '다보내 · 이천',
      capacity: 20,
      chargeWeight: 550,
      threshold: 200,
    },
    {
      sku: '300003',
      name: 'GOLDEN HOUR 앨범 · C ver.',
      project: 'ATEEZ GOLDEN HOUR',
      category: '앨범',
      center: '다보내 · 이천',
      capacity: 20,
      chargeWeight: 550,
      threshold: 200,
    },
    {
      sku: '500101',
      name: 'FLOWER TOUR 티셔츠 · WHITE',
      project: 'FLOWER TOUR MD',
      category: '티셔츠',
      center: '패스트박스 · 김포',
      capacity: 10,
      chargeWeight: 1200,
      threshold: 80,
    },
    {
      sku: '500102',
      name: 'FLOWER TOUR 에코백',
      project: 'FLOWER TOUR MD',
      category: '에코백',
      center: '패스트박스 · 김포',
      capacity: 15,
      chargeWeight: 1000,
      threshold: 50,
    },
    {
      sku: '500103',
      name: 'PIT-A-PAT 아크릴 응원봉',
      project: 'PIT-A-PAT',
      category: '응원봉',
      center: '다보내 · 이천',
      capacity: 6,
      chargeWeight: 2200,
      threshold: 50,
    },
    {
      sku: '500104',
      name: '팬미팅 포토카드 · 증정',
      project: 'PIT-A-PAT',
      category: '증정품',
      center: '다보내 · 이천',
      capacity: 15000,
      chargeWeight: 1,
      threshold: 100,
      isGift: true,
    },
    {
      sku: '500105',
      name: 'FAN KIT 멤버십 키트',
      project: '2026 FAN KIT',
      category: '멤버십키트',
      center: '패스트박스 · 김포',
      capacity: 4,
      chargeWeight: 3500,
      threshold: 40,
    },
  ];
  const req = (
    id: string,
    project: string,
    type: '입고' | '출고',
    sku: string,
    qty: number,
    date: string,
    owner: string,
    status: string,
    approved: boolean,
    note: string,
  ): RequestItem => ({
    id,
    project,
    type,
    sku,
    qty,
    date,
    owner,
    assignee: 'staff',
    status,
    approved,
    note,
    recipient: '데모 수령인',
    phone: '010-0000-0000',
    address: '서울특별시 데모 수령지',
    version: 1,
    createdAt: offsetDate(-3) + 'T09:00:00Z',
  });
  const requests = [
    req(
      'REQ-1028',
      'ATEEZ GOLDEN HOUR 3차',
      '출고',
      '300001',
      320,
      offsetDate(1),
      'requester',
      '물류팀 확인 중',
      false,
      '영상통화 당첨자 60명 포함. 사인 앨범 별도 확인 필요',
    ),
    req(
      'REQ-1027',
      'FLOWER TOUR MD 2차',
      '출고',
      '500101',
      120,
      offsetDate(2),
      'requester2',
      '슬랙 논의 중',
      true,
      '현장 수령 마감 16시. 배차 일정 협의',
    ),
    req(
      'REQ-1026',
      '2026 FAN KIT 입고',
      '입고',
      '500105',
      600,
      offsetDate(0),
      'requester',
      '물류팀 확인 중',
      true,
      '분할 입고 예정. 실입고수량 확인 후 완료 처리',
    ),
    req(
      'REQ-1025',
      'PIT-A-PAT 상시판매',
      '출고',
      '500103',
      80,
      offsetDate(0),
      'requester2',
      '배송 중',
      true,
      '운송 정보 예시: 택배 출고 진행 중',
    ),
    req(
      'REQ-1024',
      'GOLDEN HOUR 재입고',
      '입고',
      '300002',
      200,
      offsetDate(-2),
      'requester',
      '입고 완료',
      true,
      '정상 입고 확인',
    ),
    req(
      'REQ-1023',
      'FLOWER 현장 직납',
      '출고',
      '500102',
      50,
      offsetDate(-1),
      'requester',
      '출고 완료',
      true,
      '현장 수령 확인',
    ),
  ];
  requests[4].actual = 200;
  requests[5].actual = 50;
  const initial = [1600, 1200, 980, 450, 300, 160, 4500, 90];
  const movements: Movement[] = products.map((p, i) => ({
    id: 'OPEN-' + p.sku,
    sku: p.sku,
    qty: initial[i],
    type: '기초 재고',
    project: p.project,
    requestId: '-',
    actor: 'admin',
    at: offsetDate(-14) + 'T09:00:00Z',
    memo: '프로토타입 예시 기초 데이터',
  }));
  movements.push(
    {
      id: 'MOV-01',
      sku: '300002',
      qty: 200,
      type: '입고',
      project: requests[4].project,
      requestId: 'REQ-1024',
      actor: 'staff',
      at: offsetDate(-2) + 'T10:30:00Z',
      memo: '실입고수량 확인',
    },
    {
      id: 'MOV-02',
      sku: '500102',
      qty: -50,
      type: '출고',
      project: requests[5].project,
      requestId: 'REQ-1023',
      actor: 'staff',
      at: offsetDate(-1) + 'T14:20:00Z',
      memo: '현장 직납 완료',
    },
  );
  return {
    actors,
    actorId: 'admin',
    products,
    requests,
    movements,
    changes: [
      {
        id: 'CHG-001',
        requestId: 'REQ-1027',
        owner: 'requester2',
        qty: 150,
        date: offsetDate(3),
        reason: '현장 판매 수량 증가로 30개 추가 및 일정 하루 연기',
        status: '대기',
        baseVersion: 1,
        createdAt: iso(),
      },
    ],
    audits: [
      {
        id: 'LOG-001',
        at: iso(),
        actor: 'staff',
        action: '출고 완료',
        target: 'REQ-1023',
        before: '배송 중',
        after: '출고 완료 · 실수량 50개',
      },
      {
        id: 'LOG-002',
        at: offsetDate(-1) + 'T10:00:00Z',
        actor: 'staff',
        action: '프로젝트 승인',
        target: 'REQ-1027',
        before: '승인 대기',
        after: '일정 캘린더 자동 등록',
      },
    ],
    contracts: [
      {
        id: 'a',
        name: '다보내',
        base: 2300,
        labor: 1000,
        overseasLabor: 1000,
        material: 100,
        free: 4,
        extra: 50,
        cap: 1000,
        version: 1,
      },
      {
        id: 'b',
        name: '패스트박스',
        base: 2100,
        labor: 1100,
        overseasLabor: 1200,
        material: 150,
        free: 4,
        extra: 70,
        cap: 0,
        version: 1,
      },
    ],
    tariffs: [
      { country: 'JP', weight: 500, a: 21350, b: 16000 },
      { country: 'JP', weight: 1000, a: 23350, b: 17500 },
      { country: 'JP', weight: 2000, a: 28000, b: 22000 },
      { country: 'JP', weight: 5000, a: 42000, b: 35000 },
      { country: 'US', weight: 500, a: 25000, b: 27000 },
      { country: 'US', weight: 1000, a: 32000, b: 34500 },
      { country: 'US', weight: 2000, a: 45000, b: 49000 },
      { country: 'US', weight: 5000, a: 72000, b: 78000 },
    ],
    notices: [
      {
        id: 'N-01',
        at: iso(),
        title: '수정 요청이 도착했어요',
        message: 'FLOWER TOUR MD 2차 · 수량 및 일정 변경',
        target: '물류 운영팀',
        status: '앱 내 알림',
        attempts: 0,
      },
    ],
    jobs: [],
    recurring: [
      {
        id: 'REC-01',
        name: 'SS 상시판매 정기 출고',
        supplier: '다보내',
        weekday: '화요일',
        skus: ['500101', '500102'],
        enabled: true,
      },
      {
        id: 'REC-02',
        name: 'FS 상시판매 정기 출고',
        supplier: '패스트박스',
        weekday: '화요일',
        skus: ['500103', '500104'],
        enabled: true,
      },
    ],
  };
}

export const requestItems = (r: RequestItem): RequestLine[] =>
  r.items?.length ? r.items : [{ sku: r.sku, qty: r.qty, actual: r.actual }];
export const projectNum = (r: RequestItem) => r.num ?? Number(r.id.match(/^REQ-(\d+)$/)?.[1] || 0);
export function normalizeState(s: State) {
  const categories: Record<string, string> = {
    '제품(노머스제작)': '제품(Knowmerce 제작)',
    '대행(노머스돈안들어감)': '대행(Knowmerce 비용 제외)',
  };
  for (const p of s.products) if (categories[p.category]) p.category = categories[p.category];
  for (const r of s.requests)
    if (r.inboundAttribute === '노머스로바로받음-노머스(회사)직접 받음')
      r.inboundAttribute = 'Knowmerce로 바로 받음 (회사 직접 수령)';
  let next = Math.max(s.nextRequestNum || 0, ...s.requests.map(projectNum));
  for (const r of [...s.requests].reverse()) if (!projectNum(r)) r.num = ++next;
  s.nextRequestNum = next;
  return s;
}
export const inboundMethods = ['퀵/박스', '퀵/파레트', '택배', '방문입고(물류팀)'];
export const outboundMethods = ['퀵/박스', '퀵/파레트', '택배', '방문출고(물류팀)', '픽업 출고'];

export function projectCenters(s: State, r: RequestItem): string[] {
  if (r.center) return [r.center];
  return [
    ...new Set(
      requestItems(r).map((x) => {
        const center = s.products.find((p) => p.sku === x.sku)?.center || '';
        return center.includes('패스트') || center.includes('패박')
          ? '패박'
          : center.includes('다보내')
            ? '다보내'
            : '미배정';
      }),
    ),
  ];
}
export type CalendarEvent = {
  id: string;
  request: RequestItem;
  date: string;
  kind: string;
  center: string;
};
export function calendarEvents(s: State): CalendarEvent[] {
  return s.requests
    .filter((r) => r.approved && !['반려', '취소'].includes(r.status))
    .flatMap((r) =>
      projectCenters(s, r).flatMap((center) => {
        const events: CalendarEvent[] = [
          {
            id: r.id + center + 'start',
            request: r,
            date: r.date,
            kind: r.type === '출고' && r.expectedCompletion === r.date ? '출고 · 완료예정' : r.type,
            center,
          },
        ];
        if (r.type === '출고' && r.expectedCompletion && r.expectedCompletion !== r.date)
          events.push({
            id: r.id + center + 'end',
            request: r,
            date: r.expectedCompletion,
            kind: '출고 완료예정',
            center,
          });
        return events;
      }),
    );
}
export function approvalMessage(s: State, r: RequestItem) {
  const name = (id: string) => s.actors.find((a) => a.id === id)?.name || id;
  const lines = requestItems(r);
  return `요청자 : @${name(r.owner)}\n물류담당자 : @${name(r.assignee)}\n프로젝트 : [${r.project}]\n등록 상품 : ${s.products.find((p) => p.sku === lines[0].sku)?.name || lines[0].sku}${lines.length > 1 ? ' 외 ' + (lines.length - 1) + '건' : ''}\n시행 일시 : ${r.date}\n특이사항 : ${r.note || '-'}`;
}

export const inboundAttributes = [
  '현장 직납',
  'Knowmerce로 바로 받음 (회사 직접 수령)',
  '현장 갔다가 창고 리턴',
  '창고 최초 입고',
];
export const outboundReasons = [
  '이벤트당첨증정',
  '판매(고객/회사등)',
  '판매대행상품소속사이동',
  '창고이동',
  '고객앨범전달용(사인회등)',
  '소속사증정(샘플)',
  'CS',
  '자체이동(현장판매/싸인받기)',
  '그 외',
];

export function matchesRequestFilter(s: State, r: RequestItem, filter: string) {
  if (filter === '전체') return true;
  if (filter === '승인대기' || filter === '승인 대기')
    return r.status === '물류팀 확인 중' && !r.approved;
  if (filter === '배송 중') return ['배송 중', '출고중'].includes(r.status);
  if (filter === '완료') return r.status === '입고 완료' || r.status === '출고 완료';
  if (filter === '수정 요청')
    return s.changes.some((c) => c.requestId === r.id && c.status === '대기');
  return r.type === filter || r.status === filter;
}
export function outboundShortages(
  s: State,
  r: { type: string; items?: RequestLine[]; sku?: string; qty?: number },
) {
  const lines = r.items?.length ? r.items : r.sku ? [{ sku: r.sku, qty: r.qty || 0 }] : [];
  return r.type === '출고'
    ? lines.filter(
        (x) => x.qty > 0 && (inventoryStock(s, x.sku) === null || x.qty > stock(s, x.sku)),
      )
    : [];
}
