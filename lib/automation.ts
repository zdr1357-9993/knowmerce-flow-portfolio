import { State, Product } from './model';

const integer = (value: any, min: number, max: number, label: string) => {
  const n = Number(value);
  if (
    value === '' ||
    value === null ||
    value === undefined ||
    !Number.isInteger(n) ||
    n < min ||
    n > max
  )
    throw Error(label);
  return n;
};
export function transform(s: State, input: any) {
  if (!['album', 'md'].includes(input.mode)) throw Error('앨범 또는 MD 가공을 선택해주세요.');
  const mode = input.mode,
    raw = input.rows;
  if (!Array.isArray(raw) || !raw.length)
    throw Error('주문서가 비어 있습니다. CSV 파일 또는 예시 주문서를 선택해 주세요.');
  if (raw.length > 5000) throw Error('한 번에 5,000행까지 처리할 수 있습니다.');
  const warnings: string[] = [],
    issues: { row: number; order: string; message: string }[] = [],
    products = new Map<string, Product>();
  let excludedRows = 0,
    excludedQty = 0;
  const rows = raw.flatMap((r: any, i: number) => {
    if (
      String(r.shippingStatus || r.source?.['배송진행여부'] || '')
        .trim()
        .toLowerCase() === 'cancelled'
    ) {
      excludedRows++;
      excludedQty += Number(r.qty) || 0;
      return [];
    }
    const order = String(r.order || '').trim(),
      sku = String(r.sku || '').trim(),
      country = String(r.country || '')
        .trim()
        .toUpperCase();
    if (!order || !sku) throw Error(`${i + 1}행의 주문번호와 품번을 확인해주세요.`);
    const qty = integer(r.qty, 1, 1000000, `${i + 1}행의 수량은 1 이상의 정수여야 합니다.`);
    if (!/^[A-Z]{2}$/.test(country))
      throw Error(`${i + 1}행의 국가코드를 확인해주세요. KR, JP, US 등 두 자리 코드가 필요합니다.`);
    const master = s.products.find((p) => p.sku === sku),
      setting = input.productSettings?.[sku];
    if (!master && !setting?.name)
      throw Error(`등록되지 않은 품번: ${sku} · 상품 이름과 포장 기준을 설정해주세요.`);
    if (!products.has(sku)) {
      const p: Product = {
        ...(master || {
          sku,
          name: String(setting.name).slice(0, 150),
          project: String(input.project || ''),
          category: 'MD',
          center: '미배정',
          threshold: 0,
        }),
        capacity: setting?.capacity ?? input.capacities?.[sku] ?? master?.capacity,
        chargeWeight: setting?.chargeWeight ?? master?.chargeWeight,
        isGift: setting?.isGift ?? master?.isGift,
      };
      p.capacity = integer(
        p.capacity,
        1,
        15000,
        `${p.name}: 박스당 수량을 1~15,000 정수로 입력해주세요.`,
      );
      p.chargeWeight = integer(
        p.chargeWeight,
        1,
        1000000,
        `${p.name}: 비용 예측용 청구무게를 1 이상의 정수(g)로 입력해주세요.`,
      );
      products.set(sku, p);
    }
    return [
      { ...r, order, sku, qty, country, source: r.source || {}, sourceRow: r.sourceRow || i + 1 },
    ];
  });
  if (!rows.length) throw Error('가공할 주문이 없습니다. 모든 주문이 취소 상태인지 확인해주세요.');
  const grouped = new Map<string, any[]>();
  for (const r of rows) {
    const group = grouped.get(r.order) || [];
    if (group.length) {
      for (const key of ['country', 'recipient', 'phone', 'address'])
        if (String(group[0][key] || '').trim() !== String(r[key] || '').trim())
          throw Error(
            `${r.order}: 같은 주문번호의 국가·수령인·연락처·주소가 다릅니다. 주문을 분리하거나 원본을 확인해주세요.`,
          );
    }
    group.push(r);
    grouped.set(r.order, group);
    if (r.country === 'KR' && r.phone && !/^010-\d{4}-\d{4}$/.test(String(r.phone)))
      issues.push({
        row: r.sourceRow,
        order: r.order,
        message: '국내 연락처 형식 확인 필요 (010-XXXX-XXXX)',
      });
    if (r.country === 'KR' && r.postal && !/^\d{5}$/.test(String(r.postal)))
      issues.push({ row: r.sourceRow, order: r.order, message: '국내 우편번호 5자리 확인 필요' });
    if (!r.recipient || !r.address)
      issues.push({ row: r.sourceRow, order: r.order, message: '수령인·주소 정보 확인 필요' });
  }
  const winners = new Map<string, number>();
  if (mode === 'album')
    for (const w of input.winners || []) {
      const key = String(w.order || '').trim();
      if (key) winners.set(key, (winners.get(key) || 0) + 1);
    }
  const target = String(input.targetSku || '');
  const isTarget = (r: any) =>
    products.get(r.sku)?.category === '앨범' && (!target || r.sku === target);
  for (const [order, count] of winners) {
    const items = grouped.get(order);
    if (!items) throw Error(`당첨자 주문번호를 찾지 못했습니다: ${order}`);
    if (items.filter(isTarget).reduce((n, r) => n + r.qty, 0) < count)
      throw Error(`차감 수량이 구매 수량보다 많습니다: ${order}`);
  }
  const defaultVariants = s.products
    .filter((p) => p.category === '앨범')
    .slice(0, 3)
    .map((p) => p.sku);
  const variantIds = mode === 'album' ? input.variants || defaultVariants : [];
  const variants: Product[] = variantIds.map((sku: string) =>
    s.products.find((p) => p.sku === sku),
  );
  if (
    mode === 'album' &&
    (variants.length === 0 ||
      variants.some((p) => !p || p.category !== '앨범') ||
      new Set(variantIds).size !== variants.length ||
      new Set(variants.map((p) => p.project)).size !== 1)
  )
    throw Error('앨범 버전은 같은 프로젝트의 중복 없는 앨범 품번으로 설정해주세요.');
  if (mode === 'album')
    for (const p of variants) {
      const setting = input.productSettings?.[p.sku];
      products.set(p.sku, {
        ...p,
        chargeWeight: integer(
          setting?.chargeWeight ?? p.chargeWeight,
          1,
          1000000,
          `${p.name}: 청구무게를 확인해주세요.`,
        ),
      });
    }
  const limit =
    mode === 'album'
      ? integer(
          input.boxLimit,
          1,
          1000,
          '한 박스의 최대 앨범 수량을 1~1,000 사이 정수로 입력해 주세요.',
        )
      : 0;
  const processed: any[] = [],
    deductionRows: any[] = [];
  const emit = (r: any) => {
    if (processed.length >= 20000)
      throw Error('분할 결과가 20,000행을 초과합니다. 주문서를 나눠서 처리해주세요.');
    processed.push(r);
  };
  for (const [order, items] of grouped) {
    let box = 1,
      used = 0,
      deduct = winners.get(order) || 0;
    // Album packs and other products use distinct box suffixes, preventing ID collisions.
    if (mode === 'album')
      for (const r of items.filter(isTarget)) {
        const remove = Math.min(r.qty, deduct);
        deduct -= remove;
        let qty = r.qty - remove;
        if (remove)
          deductionRows.push({ order, sku: r.sku, before: r.qty, deducted: remove, after: qty });
        while (qty > 0) {
          const amount = Math.min(qty, limit);
          variants.forEach((p, i) => {
            const n = Math.floor(amount / variants.length) + (i < amount % variants.length ? 1 : 0);
            if (n)
              emit({
                ...r,
                sku: p.sku,
                name: p.name,
                qty: n,
                order: order + '-' + box,
                original: order,
              });
          });
          qty -= amount;
          box++;
        }
      }
    for (const r of items.filter((r) => mode === 'md' || !isTarget(r))) {
      let qty = r.qty;
      const p = products.get(r.sku)!;
      const unit = p.isGift ? 1 : 15000 / p.capacity;
      while (qty > 0) {
        if (used + unit > 15000 + 0.000001) {
          box++;
          used = 0;
        }
        const n = Math.min(qty, Math.floor((15000 - used + 0.000001) / unit));
        if (n < 1) throw Error(`${p.name}: 포장 기준을 확인해주세요.`);
        emit({ ...r, qty: n, name: p.name, order: order + '-' + box, original: order });
        used += n * unit;
        qty -= n;
      }
    }
  }
  const winnerAdditionRows: any[] = [];
  const addition = input.winnerAddition;
  if (mode === 'album' && addition?.enabled) {
    const selected = new Set(
      (addition.options || []).map((v: any) => String(v).trim()).filter(Boolean),
    );
    const sku = String(addition.sku || '').trim(),
      name = String(addition.name || '').trim();
    if (!selected.size) throw Error('당첨자 추가 대상 Option을 하나 이상 선택해주세요.');
    if (!sku || !name) throw Error('당첨자 추가 상품의 품번과 상품명을 입력해주세요.');
    if (products.has(sku)) throw Error(`당첨자 추가 품번 ${sku}이 기존 상품 품번과 중복됩니다.`);
    const unitQty = integer(
      addition.unitQty,
      1,
      1000,
      '당첨자 추가 수량은 1 이상의 정수여야 합니다.',
    );
    const chargeWeight = integer(
      addition.chargeWeight,
      1,
      1000000,
      '당첨자 추가 상품의 예측 청구무게를 확인해주세요.',
    );
    const unitPrice = integer(
      addition.unitPrice,
      1,
      1000000,
      '당첨자 추가 상품 가격은 1 이상의 정수여야 합니다.',
    );
    const product: Product = {
      sku,
      name,
      project: String(input.project || ''),
      category: 'MD',
      center: '미배정',
      threshold: 0,
      capacity: 15000,
      chargeWeight,
      isGift: false,
    };
    products.set(sku, product);
    const counts = new Map<string, number>();
    for (const w of input.winners || []) {
      const order = String(w.order || '').trim(),
        option = String(w.option || '당첨자').trim();
      if (order && selected.has(option)) counts.set(order, (counts.get(order) || 0) + 1);
    }
    for (const [order, count] of counts) {
      const items = grouped.get(order);
      if (!items) throw Error(`당첨자 추가 주문번호를 찾지 못했습니다: ${order}`);
      const base = items[0],
        lastBox = Math.max(
          1,
          ...processed
            .filter((r: any) => r.original === order)
            .map((r: any) => {
              const m = String(r.order).match(/-(\d+)$/);
              return m ? Number(m[1]) : 1;
            }),
        );
      const row = {
        ...base,
        sku,
        name,
        qty: count * unitQty,
        order: `${order}-${lastBox}`,
        original: order,
        source: {
          ...base.source,
          재고코드: sku,
          재고명: name,
          상품명: name,
          수량: count * unitQty,
          상품금액: unitPrice,
        },
        winnerAddition: true,
        winnerOptions: (input.winners || [])
          .filter(
            (w: any) => w.order === order && selected.has(String(w.option || '당첨자').trim()),
          )
          .map((w: any) => w.option || '당첨자'),
      };
      emit(row);
      winnerAdditionRows.push({
        order,
        box: row.order,
        sku,
        name,
        optionCount: count,
        qty: row.qty,
        country: base.country,
        options: row.winnerOptions.join(' · '),
      });
    }
  }
  const boxes = new Map<string, any>();
  for (const r of processed) {
    const p = products.get(r.sku)!;
    const b = boxes.get(r.order) || {
      order: r.order,
      original: r.original,
      country: r.country,
      qty: 0,
      weight: 0,
      volume: 0,
      a: 0,
      b: 0,
      breakdown: {},
    };
    b.qty += r.qty;
    b.weight += p.chargeWeight * r.qty;
    b.volume +=
      (mode === 'album' && p.category === '앨범'
        ? 15000 / limit
        : p.isGift
          ? 1
          : 15000 / p.capacity) * r.qty;
    boxes.set(r.order, b);
  }
  for (const b of boxes.values()) {
    b.billableWeight = Math.ceil(b.weight / 500) * 500;
    const tariff =
      b.country === 'KR'
        ? null
        : s.tariffs.find((t) => t.country === b.country && t.weight === b.billableWeight);
    if (b.country !== 'KR' && !tariff)
      warnings.push(
        `${b.country} / ${b.billableWeight.toLocaleString()}g 운임이 없습니다. 해당 박스의 비용은 미산정입니다.`,
      );
    for (const c of s.contracts) {
      const extra = Math.max(0, b.qty - c.free) * c.extra;
      const additional = c.cap ? Math.min(c.cap, extra) : extra;
      const freight = b.country === 'KR' ? c.base : tariff ? (tariff as any)[c.id] : null;
      const labor = b.country === 'KR' ? c.labor : c.overseasLabor;
      b[c.id] = freight === null ? null : freight + labor + c.material + additional;
      b.breakdown[c.id] = { freight, labor, material: c.material, additional, total: b[c.id] };
    }
  }
  const all = [...boxes.values()];
  const sum = (list: any[]) => ({
    a: list.reduce((n, b) => n + (b.a ?? 0), 0),
    b: list.reduce((n, b) => n + (b.b ?? 0), 0),
    complete: list.every((b) => b.a !== null && b.b !== null),
    boxes: list.length,
  });
  const cost = {
    ...sum(all),
    domestic: sum(all.filter((b) => b.country === 'KR')),
    international: sum(all.filter((b) => b.country !== 'KR')),
  };
  const qty = processed.reduce((n, r) => n + r.qty, 0),
    eligibleQty = rows.reduce((n, r) => n + r.qty, 0),
    deducted = [...winners.values()].reduce((n, c) => n + c, 0),
    addedQty = winnerAdditionRows.reduce((n, r) => n + r.qty, 0);
  if (qty !== eligibleQty - deducted + addedQty)
    throw Error('가공 전후 수량 검증에 실패했습니다. 결과를 확정할 수 없습니다.');
  const inventory = [...new Set(processed.map((r) => r.sku))].map((sku) => ({
    sku,
    name: products.get(sku)!.name,
    qty: processed.filter((r) => r.sku === sku).reduce((n, r) => n + r.qty, 0),
  }));
  return {
    rows: processed,
    boxes: all,
    boxCount: all.length,
    qty,
    deducted,
    addedQty,
    winnerAdditionRows,
    deductionRows,
    inventory,
    issues,
    warnings: [...new Set(warnings)],
    cost,
    empty: !processed.length,
    reconciliation: {
      originalQty: raw.reduce((n: number, r: any) => n + (Number(r.qty) || 0), 0),
      excludedRows,
      excludedQty,
      eligibleQty,
      deducted,
      addedQty,
      resultQty: qty,
      balanced: true,
    },
    basis: {
      version: 'md-planning-1',
      products: [...products.values()],
      contracts: structuredClone(s.contracts),
      tariffs: structuredClone(s.tariffs),
    },
    reference:
      '등록·입력한 청구무게와 계약 기준에 따른 예상 비용입니다. 실제 청구 금액은 3PL 검수 후 확정됩니다.',
  };
}
