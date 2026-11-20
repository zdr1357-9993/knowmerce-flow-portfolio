export type OrderRow = {
  order: string;
  sku: string;
  name: string;
  qty: number;
  country: string;
  recipient: string;
  phone: string;
  postal: string;
  address: string;
  shippingStatus: string;
  sourceRow: number;
  source: Record<string, string>;
};
export function csvTable(text: string) {
  const rows: string[][] = [];
  const src = text.replace(/^\uFEFF/, '');
  let row: string[] = [],
    value = '',
    quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"') {
      if (quoted && src[i + 1] === '"') {
        value += '"';
        i++;
      } else if (!quoted && value !== '') throw Error('CSV 따옴표 형식을 확인해주세요.');
      else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(value);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      value = '';
    } else value += c;
  }
  if (quoted) throw Error('CSV의 닫히지 않은 따옴표를 확인해주세요.');
  row.push(value);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
export function parseOrderCSV(text: string): OrderRow[] {
  const table = csvTable(text),
    heads = table.shift()?.map((x) => x.trim()) || [];
  if (!heads.length || new Set(heads).size !== heads.length || heads.some((h) => !h))
    throw Error('첫 행에 중복·빈칸 없는 열 이름이 필요합니다.');
  const index = (aliases: string[]) => heads.findIndex((h) => aliases.includes(h.toLowerCase()));
  const columns = {
    order: index(['주문번호', 'order', 'merchant uid', 'merchant_uid']),
    sku: index(['재고코드', '품번', 'sku']),
    name: index(['재고명', '상품명', '상품이름', 'name']),
    qty: index(['수량', 'qty']),
    country: index(['국가코드', 'country']),
    recipient: index(['받는사람', '받는 사람', '수령인', 'recipient']),
    phone: index(['전화번호', '연락처', 'phone']),
    postal: index(['우편번호', 'postal']),
    address: index(['주소', '주소1', '배송지주소', 'address']),
    detail: index(['상세주소', '주소2']),
    status: index(['배송진행여부', 'shippingstatus']),
  };
  if ([columns.order, columns.sku, columns.qty, columns.country].some((i) => i < 0))
    throw Error('주문번호·재고코드(품번)·수량·국가코드 열이 필요합니다.');
  if (!table.length || table.length > 5000) throw Error('주문서는 1~5,000행으로 업로드해주세요.');
  return table.map((cells, i) => {
    if (cells.length !== heads.length)
      throw Error(`${i + 2}행의 열 수가 맞지 않습니다. 쉼표가 있는 값은 큰따옴표로 감싸주세요.`);
    const get = (key: keyof typeof columns) =>
      columns[key] < 0 ? '' : String(cells[columns[key]] || '').trim();
    let phone = get('phone');
    const country = get('country').toUpperCase();
    if (country === 'KR') {
      let digits = phone.replace(/\D/g, '');
      if (digits.length === 10 && digits.startsWith('10')) digits = '0' + digits;
      if (digits.length === 11 && digits.startsWith('010'))
        phone = digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7);
    }
    return {
      order: get('order'),
      sku: get('sku'),
      name: get('name'),
      qty: Number(get('qty')),
      country,
      recipient: get('recipient'),
      phone,
      postal: get('postal'),
      address: [get('address'), get('detail')].filter(Boolean).join(' '),
      shippingStatus: get('status'),
      sourceRow: i + 2,
      source: Object.fromEntries(heads.map((h, n) => [h, cells[n]])),
    };
  });
}
export function csvText(rows: Record<string, any>[]) {
  const heads = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const quote = (v: any) => {
    let str = String(v ?? '');
    if (typeof v === 'string' && /^[=+@]/.test(str)) str = "'" + str;
    return '"' + str.replace(/"/g, '""') + '"';
  };
  return (
    '\uFEFF' +
    [heads.map(quote).join(','), ...rows.map((r) => heads.map((h) => quote(r[h])).join(','))].join(
      '\r\n',
    )
  );
}
export function outputRows(rows: any[]) {
  return rows.map((r, index) => {
    const source = r.source || {},
      country = r.country,
      addr = source['상세주소'];
    let price = Number(String(source['상품금액'] ?? '').replace(/,/g, ''));
    if (!Number.isFinite(price)) price = 0;
    if (price === 0) price = 1;
    let currency = String(source['결제통화'] || 'USD');
    if (country !== 'KR' && currency === 'KRW') {
      currency = 'USD';
      if (price > 1) price /= 1000;
    }
    const state = source['주'] || source['국가명'] || '',
      city = source['도시'] || state,
      id = String(source['id'] || '').trim(),
      bundle = String(source['배송비묶음'] || '').slice(0, 3);
    const itemCode = id
      ? `${id}-${bundle || '000'}-${index + 1}`
      : `NAN_${String(Math.floor(Math.random() * 1e10))
          .padStart(10, '0')
          .replace(/(\d{3})(\d{3})(\d{4})/, '$1_$2_$3')}`;
    return {
      ...source,
      재고명: r.name,
      상품명: r.name,
      옵션명: r.name,
      주문번호: r.order,
      원주문번호: r.original || r.order,
      재고코드: r.sku,
      수량: r.qty,
      상품금액: price,
      실결제금액: r.qty * price,
      결제통화: currency,
      국가코드: country,
      받는사람: r.recipient || '',
      전화번호: r.phone || '',
      우편번호: r.postal || '',
      주소: source['주소'] || source['주소1'] || r.address || '',
      상세주소: country === 'KR' ? addr || '' : (addr || '').trim() || '-',
      희망배송사:
        country === 'KR'
          ? ''
          : country === 'JP'
            ? 'sagawa'
            : ['US', 'IT', 'CO'].includes(country)
              ? 'ups'
              : 'ems',
      주: country === 'KR' ? source['주'] || '' : state,
      도시: country === 'KR' ? source['도시'] || '' : city,
      '판매사 품주번호': itemCode,
    };
  });
}
export const mdExample = () =>
  parseOrderCSV(
    csvText([
      {
        주문번호: 'MD-DEMO-001',
        재고코드: '500101',
        상품명: 'FLOWER TOUR 티셔츠 · WHITE',
        수량: 6,
        국가코드: 'KR',
        받는사람: '예시 수령인',
        전화번호: '01000000000',
        우편번호: '01234',
        주소: '서울특별시 예시 주소',
      },
      {
        주문번호: 'MD-DEMO-001',
        재고코드: '500102',
        상품명: 'FLOWER TOUR 에코백',
        수량: 8,
        국가코드: 'KR',
        받는사람: '예시 수령인',
        전화번호: '01000000000',
        우편번호: '01234',
        주소: '서울특별시 예시 주소',
      },
      {
        주문번호: 'MD-DEMO-002',
        재고코드: '500101',
        상품명: 'FLOWER TOUR 티셔츠 · WHITE',
        수량: 2,
        국가코드: 'JP',
        받는사람: 'DEMO RECIPIENT',
        전화번호: '0000000000',
        우편번호: '0000000',
        주소: 'Demo address Japan',
      },
      {
        주문번호: 'MD-DEMO-002',
        재고코드: '500102',
        상품명: 'FLOWER TOUR 에코백',
        수량: 1,
        국가코드: 'JP',
        받는사람: 'DEMO RECIPIENT',
        전화번호: '0000000000',
        우편번호: '0000000',
        주소: 'Demo address Japan',
      },
      {
        주문번호: 'MD-DEMO-003',
        재고코드: '500102',
        상품명: 'FLOWER TOUR 에코백',
        수량: 3,
        국가코드: 'US',
        받는사람: 'DEMO RECIPIENT',
        전화번호: '0000000000',
        우편번호: '00000',
        주소: 'Demo address United States',
      },
    ]),
  );
export const albumExample = () =>
  parseOrderCSV(
    csvText([
      {
        merchant_uid: 'ATZ-DEMO-001',
        재고코드: '300001',
        재고명: 'ATEEZ GOLDEN HOUR 랜덤 앨범',
        상품명: 'ATEEZ GOLDEN HOUR 랜덤 앨범',
        수량: 42,
        국가코드: 'KR',
        받는사람: '예시 수령인 1',
        전화번호: '01012345678',
        우편번호: '04524',
        주소: '서울특별시 중구 예시로 10',
      },
      {
        merchant_uid: 'ATZ-DEMO-002',
        재고코드: '300001',
        재고명: 'ATEEZ GOLDEN HOUR 랜덤 앨범',
        상품명: 'ATEEZ GOLDEN HOUR 랜덤 앨범',
        수량: 1,
        국가코드: 'KR',
        받는사람: '예시 수령인 2',
        전화번호: '01023456789',
        우편번호: '06164',
        주소: '서울특별시 강남구 예시로 20',
      },
      {
        merchant_uid: 'ATZ-DEMO-003',
        재고코드: '300001',
        재고명: 'ATEEZ GOLDEN HOUR 랜덤 앨범',
        상품명: 'ATEEZ GOLDEN HOUR 랜덤 앨범',
        수량: 1,
        국가코드: 'JP',
        받는사람: 'DEMO RECIPIENT JP',
        전화번호: '0312345678',
        우편번호: '1000001',
        주소: 'Tokyo demo address',
      },
      {
        merchant_uid: 'ATZ-DEMO-004',
        재고코드: '300001',
        재고명: 'ATEEZ GOLDEN HOUR 랜덤 앨범',
        상품명: 'ATEEZ GOLDEN HOUR 랜덤 앨범',
        수량: 1,
        국가코드: 'US',
        받는사람: 'DEMO RECIPIENT US',
        전화번호: '5551234567',
        우편번호: '10001',
        주소: 'New York demo address',
      },
    ]),
  );
export const albumWinnerExample = () => [
  { order: 'ATZ-DEMO-001', option: '당첨자' },
  { order: 'ATZ-DEMO-001', option: '팬싸인회' },
  { order: 'ATZ-DEMO-002', option: '당첨자' },
];
