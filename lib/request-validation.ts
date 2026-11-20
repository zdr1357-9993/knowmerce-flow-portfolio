import { State, inboundMethods, inboundAttributes, outboundReasons } from './model';
import { fail } from './errors';

type RequestInput = {
  id?: string;
  project?: string;
  type: '입고' | '출고';
  sku: string;
  qty: number | string | null;
  date: string;
  items?: { sku?: string; qty?: number | string | null; barcode?: string }[];
  note?: string;
  recipient?: string;
  phone?: string;
  address?: string;
  method?: string;
  inboundAttribute?: string;
  time?: string;
  transport?: string;
  country?: string;
  reason?: string;
};

export const validDate = (d: unknown): d is string =>
  typeof d === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  !isNaN(Date.parse(d)) &&
  new Date(d).toISOString().slice(0, 10) === d;

export const cleanRequest = (s: State, d: RequestInput, allowZero = false) => {
  const qty = Number(d.qty);
  if (
    !String(d.project || '').trim() ||
    !['입고', '출고'].includes(d.type) ||
    !s.products.some((p) => p.sku === d.sku) ||
    !validDate(d.date) ||
    !Number.isInteger(qty) ||
    qty < (allowZero ? 0 : 1) ||
    qty > 1000000
  )
    fail('프로젝트명·유형·품번·일정·양의 정수 수량은 필수입니다.');
  if (d.type === '출고' && (!d.recipient?.trim() || !d.phone?.trim() || !d.address?.trim()))
    fail('출고에는 받는 사람·연락처·도착지 주소가 필요합니다.');
  if (d.type === '출고' && !/^010-\d{4}-\d{4}$/.test(d.phone || ''))
    fail('국내 예시 요청의 연락처는 010-XXXX-XXXX 형식으로 입력해 주세요.');
  return {
    project: String(d.project).trim().slice(0, 120),
    type: d.type,
    sku: d.sku,
    qty,
    date: d.date,
    note: String(d.note || '').slice(0, 1000),
    recipient: String(d.recipient || '').slice(0, 80),
    phone: String(d.phone || '').slice(0, 40),
    address: String(d.address || '').slice(0, 250),
  };
};
export const cleanProject = (s: State, d: RequestInput, allowZero = false) => {
  if (!String(d.project || '').trim()) fail('물류 요청 이름을 입력해주세요.');
  if (!['입고', '출고'].includes(d.type) || !validDate(d.date))
    fail('요청 유형과 요청일을 입력해 주세요.');
  if (d.type === '입고' && d.method && !inboundMethods.includes(d.method))
    fail('입고방식을 확인해 주세요.');
  if (d.type === '입고' && d.inboundAttribute && !inboundAttributes.includes(d.inboundAttribute))
    fail('상품 입고 속성을 확인해 주세요.');
  if (!Array.isArray(d.items) || d.items.length > 100)
    fail('상품은 1~100개까지 입력할 수 있습니다.');
  const rows = d.items
    .map((x, i) => ({ ...x, row: i + 1 }))
    .filter(
      (x) =>
        String(x.sku || '').trim() || String(x.qty ?? '').trim() || String(x.barcode || '').trim(),
    );
  if (!rows.length) fail('상품을 한 행 이상 입력해 주세요.');
  const items = rows.map((x) => {
    const sku = String(x.sku || '').trim(),
      p = s.products.find((p) => p.sku === sku),
      qty = Number(x.qty);
    if (!p) fail(`${x.row}행의 품번을 확인해주세요.`);
    if (
      x.qty === null ||
      x.qty === '' ||
      !Number.isInteger(qty) ||
      qty < (allowZero ? 0 : 1) ||
      qty > 1000000
    )
      fail(`${x.row}행의 수량을 확인해주세요.`);
    return { sku, qty, barcode: String(x.barcode || p!.barcode || '').slice(0, 80) };
  });
  if (new Set(items.map((x) => x.sku)).size !== items.length)
    fail('동일 품번은 한 행에 수량을 합쳐 입력해 주세요.');
  const project = String(d.project || '').trim();
  const total = items.reduce((n, x) => n + x.qty, 0);
  const common = cleanRequest(
    s,
    { ...d, project, sku: items[0].sku, qty: items[0].qty },
    allowZero,
  );
  const legacy = s.requests.find((r) => r.id === d.id && r.status !== '입력완료');
  if (
    d.type === '출고' &&
    !outboundReasons.includes(String(d.reason || '')) &&
    !(legacy && String(legacy.reason || '') === String(d.reason || ''))
  )
    fail('출고 사유를 선택해 주세요.');
  return {
    ...common,
    qty: total,
    items,
    method: d.type === '입고' ? d.method || '' : '',
    inboundAttribute: d.type === '입고' ? d.inboundAttribute || '' : '',
    time: String(d.time || '').slice(0, 80),
    transport: String(d.transport || '').slice(0, 250),
    country: String(d.country || '').slice(0, 80),
    reason: String(d.reason || '').slice(0, 1000),
  };
};
