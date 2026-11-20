import {
  State,
  RequestItem,
  uid,
  iso,
  stock,
  inventoryStock,
  productCategories,
  today,
  requestItems,
  normalizeState,
  inboundMethods,
  outboundMethods,
  inboundAttributes,
  outboundReasons,
  approvalMessage,
  outboundShortages,
} from './model';
import { transform } from './automation';
import { validDate, cleanRequest, cleanProject as validateProject } from './request-validation';
import { AppError, fail } from './errors';
export { AppError } from './errors';

export function act(s: State, action: string, data: any) {
  const clean = (data: any, allowZero = false) => cleanRequest(s, data, allowZero);
  const cleanProject = (data: any, allowZero = false) => validateProject(s, data, allowZero);
  const actor = s.actors.find((a) => a.id === s.actorId)!;
  const staff = actor.role !== 'requester';
  const admin = actor.role === 'admin';
  const requireStaff = () => {
    if (!staff) fail('물류 담당자 또는 물류 어드민만 처리할 수 있습니다.', 403);
  };
  const requireAdmin = () => {
    if (!admin) fail('계약·기준정보는 물류 어드민만 수정할 수 있습니다.', 403);
  };
  const log = (action: string, target: string, before: any, after: any) =>
    s.audits.unshift({
      id: uid('LOG-'),
      at: iso(),
      actor: actor.id,
      action,
      target,
      before: typeof before === 'string' ? before : JSON.stringify(before),
      after: typeof after === 'string' ? after : JSON.stringify(after),
    });
  const notify = (title: string, message: string) =>
    s.notices.unshift({
      id: uid('N-'),
      at: iso(),
      title,
      message,
      target: '물류 운영팀',
      status: '앱 내 알림 · Slack 대기',
      attempts: 0,
    });
  const request = () => {
    const r = s.requests.find((r) => r.id === data.id);
    if (!r) fail('요청을 찾을 수 없습니다.', 404);
    return r!;
  };
  const checkVersion = (r: RequestItem) => {
    if (data.version !== r.version)
      fail('다른 변경이 반영되었습니다. 최신 프로젝트를 다시 열어 주세요.', 409);
  };
  const checkShortages = (r: any) => {
    if (outboundShortages(s, r).length && data.confirmStock !== true)
      fail('출고 요청만큼 재고가 충분하지 않습니다. 그래도 요청하시겠습니까?');
  };
  const ownDraft = (r: RequestItem) => {
    if (r.owner !== actor.id && !staff) fail('본인이 작성한 프로젝트만 처리할 수 있습니다.', 403);
    if (r.status !== '입력완료') fail('요청된 프로젝트는 논의 후 수정할 수 있습니다.');
    checkVersion(r);
  };
  switch (action) {
    case 'switch': {
      if (!s.actors.some((x) => x.id === data.actorId)) fail('계정을 선택해 주세요.');
      s.actorId = data.actorId;
      break;
    }
    case 'issue-codes': {
      const ownership = data.ownership;
      if (!['자사', '타사'].includes(ownership) || !String(data.project || '').trim())
        fail('소유권과 프로젝트를 입력해 주세요.');
      if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 50)
        fail('상품은 1~50개까지 한 번에 발번할 수 있습니다.');
      const items = data.items.filter(
        (x: any) =>
          String(x.name || '').trim() ||
          String(x.barcode || '').trim() ||
          String(x.category || '').trim(),
      );
      if (!items.length) fail('발번할 상품을 한 행 이상 입력해 주세요.');
      for (const [i, item] of items.entries()) {
        if (!String(item.name || '').trim() || !productCategories.includes(item.category))
          fail(`${i + 1}번째 상품의 상품이름과 상품 분류를 확인해 주세요.`);
        if (String(item.name).trim().length > 150 || String(item.barcode || '').trim().length > 80)
          fail('상품이름은 150자, 바코드는 80자 이내로 입력해 주세요.');
      }
      const base = ownership === '자사' ? 300000 : 500000;
      const used = s.products
        .map((p) => (/^\d{6}$/.test(p.sku) ? Number(p.sku) : 0))
        .filter((n) => n >= base && n < base + 100000);
      let next = Math.max(base - 1, ...used) + 1;
      if (next + items.length > base + 100000)
        fail('사용 가능한 품번 범위를 초과했습니다. 물류 어드민에게 문의해 주세요.');
      const batchAt = iso();
      const created = items.map((item: any) => ({
        sku: String(next++),
        name: `[${String(data.project).trim().slice(0, 120)}]_${String(item.name).trim()}`,
        project: String(data.project).trim().slice(0, 120),
        ownership,
        barcode: String(item.barcode || '').trim(),
        category: item.category,
        center: '미배정',
        capacity: item.category.startsWith('증정(') ? 15000 : 0,
        chargeWeight: 0,
        threshold: 0,
        isGift: item.category.startsWith('증정('),
        createdBy: actor.id,
        createdAt: batchAt,
      }));
      s.products.push(...created);
      for (const product of created) log('물류코드 발번', product.sku, '', product);
      notify(
        '물류코드 발번 완료',
        `${actor.name} · ${data.project} · ${created.length}개 상품 등록`,
      );
      break;
    }
    case 'save-draft': {
      const existing = data.id ? request() : null;
      if (existing) ownDraft(existing);
      const d = cleanProject(data);
      if (existing) {
        const before = { ...existing };
        Object.assign(existing, d);
        existing.version++;
        log('입력 정보 수정', existing.id, before, existing);
      } else {
        normalizeState(s);
        const r: RequestItem = {
          ...d,
          id: uid('REQ-'),
          num: ++s.nextRequestNum!,
          owner: actor.id,
          assignee: 'staff',
          status: '입력완료',
          approved: false,
          version: 1,
          createdAt: iso(),
        };
        s.requests.unshift(r);
        log('입력완료 저장', r.id, '', r);
      }
      break;
    }
    case 'direct-request': {
      const existing = data.id ? request() : null;
      if (existing) ownDraft(existing);
      const d = cleanProject(data);
      checkShortages(d);
      if (existing) {
        const before = { ...existing };
        Object.assign(existing, d, { status: '물류팀 확인 중' });
        existing.version++;
        log('바로 요청', existing.id, before, existing);
        notify('새 입출고 요청', `${existing.project} · ${existing.type} ${existing.qty}개`);
      } else {
        normalizeState(s);
        const r: RequestItem = {
          ...d,
          id: uid('REQ-'),
          num: ++s.nextRequestNum!,
          owner: actor.id,
          assignee: 'staff',
          status: '물류팀 확인 중',
          approved: false,
          version: 1,
          createdAt: iso(),
        };
        s.requests.unshift(r);
        log('바로 요청', r.id, '', r);
        notify('새 입출고 요청', `${r.project} · ${r.type} ${r.qty}개`);
      }
      break;
    }
    case 'manage-project': {
      requireStaff();
      const r = request();
      if (r.status === '취소') fail('취소된 요청은 변경할 수 없습니다.');
      checkVersion(r);
      const assignee = String(data.assignee || r.assignee);
      if (assignee !== r.assignee && !admin)
        fail('담당자는 물류 어드민만 변경할 수 있습니다.', 403);
      if (!s.actors.some((a) => a.id === assignee && a.role !== 'requester'))
        fail('물류 담당자를 선택해 주세요.');
      const center = String(data.center || '');
      if (center && !['다보내', '패박', '미배정'].includes(center)) fail('물류사를 확인해 주세요.');
      const expectedCompletion = String(data.expectedCompletion || '');
      if (expectedCompletion && (!validDate(expectedCompletion) || expectedCompletion < r.date))
        fail('완료예상 시점은 입출고 요청일 이후 날짜로 입력해 주세요.');
      const before = {
        assignee: r.assignee,
        center: r.center,
        expectedCompletion: r.expectedCompletion,
      };
      Object.assign(r, { assignee, center, expectedCompletion });
      r.version++;
      log('물류 정보 수정', r.id, before, { assignee, center, expectedCompletion });
      break;
    }
    case 'comment': {
      const r = request();
      if (r.status === '입력완료' && r.owner !== actor.id && !staff)
        fail('아직 공유되지 않은 프로젝트입니다.', 403);
      const body = String(data.body || '').trim();
      if (!body || body.length > 2000) fail('메모는 1~2,000자로 입력해 주세요.');
      const comment = { id: uid('MEMO-'), actor: actor.id, at: iso(), body };
      r.comments = [...(r.comments || []), comment];
      log('프로젝트 메모', r.id, '', comment);
      break;
    }
    case 'submit-draft': {
      const r = request();
      ownDraft(r);
      cleanProject(r, staff);
      checkShortages(r);
      r.status = '물류팀 확인 중';
      r.version++;
      log('입출고 요청', r.id, '입력완료', r.status);
      notify(
        '새 입출고 요청',
        `${r.project} · ${r.type} · ${requestItems(r).length}개 상품 / ${r.qty}개`,
      );
      break;
    }
    case 'delete-draft': {
      const r = request();
      ownDraft(r);
      log('입력완료 삭제', r.id, r, '삭제');
      s.requests = s.requests.filter((x) => x.id !== r.id);
      break;
    }
    case 'create': {
      const d = clean(data);
      checkShortages(d);
      const r: RequestItem = {
        ...d,
        id: uid('REQ-'),
        owner: actor.id,
        assignee: 'staff',
        status: '물류팀 확인 중',
        approved: false,
        version: 1,
        createdAt: iso(),
      };
      s.requests.unshift(r);
      log('입출고 요청', r.id, '', r);
      notify('새 입출고 요청', `${r.project} · ${r.type} ${r.qty}개`);
      break;
    }
    case 'approve': {
      requireStaff();
      const r = request();
      if (r.status === '입력완료') fail('입력완료 프로젝트는 요청 후 승인할 수 있습니다.');
      if (r.approved) fail('이미 승인된 요청입니다.');
      if (['반려', '취소'].includes(r.status)) fail('반려·취소된 요청은 승인할 수 없습니다.');
      const before = r.status;
      r.approved = true;
      r.status = '슬랙 논의 중';
      r.version++;
      log('프로젝트 승인', r.id, before, '슬랙 논의 중 · 캘린더 자동 등록');
      notify('프로젝트 승인 · Slack 게시물 초안', approvalMessage(s, r));
      break;
    }
    case 'reject': {
      requireStaff();
      const r = request();
      if (r.status === '입력완료') fail('아직 요청되지 않은 프로젝트입니다.');
      if (r.approved) fail('승인된 요청은 반려할 수 없습니다.');
      if (!data.reason?.trim()) fail('반려 사유를 입력해 주세요.');
      r.status = '반려';
      r.version++;
      log('요청 반려', r.id, '승인 대기', data.reason);
      break;
    }
    case 'edit': {
      requireStaff();
      const r = request();
      if (r.status.endsWith('완료') || r.status === '취소')
        fail('완료·취소된 기록은 직접 변경할 수 없습니다.');
      if (data.version !== r.version)
        fail('다른 변경이 반영되었습니다. 최신 요청을 다시 열어 주세요.', 409);
      const d =
        r.items || data.items
          ? cleanProject({ ...r, ...data }, true)
          : clean({ ...r, ...data }, true);
      const before = { ...r };
      Object.assign(r, d);
      r.version++;
      log('요청 정보 수정', r.id, before, r);
      break;
    }
    case 'change': {
      const r = request();
      if (r.owner !== actor.id && actor.role === 'requester')
        fail('본인이 작성한 요청만 수정 요청할 수 있습니다.', 403);
      if (r.status.endsWith('완료') || ['반려', '취소'].includes(r.status))
        fail('완료·반려·취소된 요청은 변경 요청할 수 없습니다.');
      if (s.changes.some((c) => c.requestId === r.id && c.status === '대기'))
        fail('이미 대기 중인 수정 요청이 있습니다.');
      if (
        !Number.isInteger(Number(data.qty)) ||
        Number(data.qty) < 1 ||
        !validDate(data.date) ||
        !data.reason?.trim()
      )
        fail('변경 수량·일정·사유를 입력해 주세요.');
      const changedItems = data.items
        ? cleanProject({ ...r, ...data, method: r.method || '', reason: r.reason || '' }).items
        : undefined;
      if (requestItems(r).length > 1 && !changedItems)
        fail('여러 상품의 수량은 상품별로 입력해 주세요.');
      const c = {
        items: changedItems,
        id: uid('CHG-'),
        requestId: r.id,
        owner: actor.id,
        qty: Number(data.qty),
        date: data.date,
        reason: String(data.reason).slice(0, 500),
        status: '대기',
        baseVersion: r.version,
        createdAt: iso(),
      };
      s.changes.unshift(c);
      log('수정 요청', r.id, { qty: r.qty, date: r.date }, c);
      notify('수정 요청 접수', r.project + ' · ' + c.reason);
      break;
    }
    case 'review-change': {
      requireStaff();
      const c = s.changes.find((c) => c.id === data.id);
      if (!c || c.status !== '대기') fail('처리 가능한 수정 요청이 없습니다.');
      const r = s.requests.find((r) => r.id === c!.requestId)!;
      if (data.approve) {
        if (r.version !== c!.baseVersion || r.status.endsWith('완료') || r.status === '취소')
          fail('원본 요청이 변경되었습니다. 최신 내용으로 수정 요청을 다시 접수해 주세요.', 409);
        const before = { qty: r.qty, date: r.date };
        r.qty = c!.items ? c!.items.reduce((n, x) => n + x.qty, 0) : c!.qty;
        if (c!.items) r.items = c!.items;
        else if (r.items) r.items = [{ ...r.items[0], qty: c!.qty }];
        r.date = c!.date;
        r.version++;
        c!.status = '승인';
        log('수정 요청 승인', r.id, before, { qty: r.qty, date: r.date });
      } else {
        c!.status = '반려';
        log('수정 요청 반려', r.id, c!.reason, String(data.reason || '담당자 검토 결과 반려'));
      }
      break;
    }
    case 'status': {
      requireStaff();
      const r = request();
      if (data.status === '취소') {
        if (!r.approved || r.status.endsWith('완료') || ['취소', '반려'].includes(r.status))
          fail('승인된 진행 중 요청만 취소할 수 있습니다.');
        if (data.confirmCancel !== true) fail('취소로 변경됩니다. 맞습니까?');
        if (data.version !== r.version)
          fail('다른 변경이 반영되었습니다. 최신 요청을 확인해주세요.', 409);
        const before = r.status;
        r.status = '취소';
        r.version++;
        for (const c of s.changes.filter((c) => c.requestId === r.id && c.status === '대기'))
          c.status = '취소';
        log('프로젝트 취소', r.id, before, '취소 · 일정 제외 · 재고 변경 없음');
        notify('프로젝트 취소', r.project + ' · 취소');
        break;
      }
      if (r.status === '취소') fail('취소된 프로젝트는 다시 진행할 수 없습니다.');
      if (!r.approved) fail('프로젝트를 먼저 승인해 주세요.');
      const next = r.type === '입고' ? '입고 완료' : '배송 중';
      const transitions: Record<string, string[]> = {
        '물류팀 확인 중': ['슬랙 논의 중', next, '이슈 해결 중'],
        '슬랙 논의 중': ['물류팀 확인 중', next, '이슈 해결 중'],
        '배송 중': ['출고 완료', '이슈 해결 중'],
        출고중: ['출고 완료', '이슈 해결 중'],
        '이슈 해결 중': ['물류팀 확인 중', '슬랙 논의 중', next],
      };
      const adminTargets = [
        '물류팀 확인 중',
        '슬랙 논의 중',
        '이슈 해결 중',
        ...(r.type === '입고' ? ['입고 완료'] : ['배송 중', '출고중', '출고 완료']),
      ];
      if (
        !(
          admin &&
          !r.status.endsWith('완료') &&
          adminTargets.includes(data.status) &&
          data.status !== r.status
        ) &&
        !transitions[r.status]?.includes(data.status)
      )
        fail('현재 상태에서는 선택한 단계로 변경할 수 없습니다.');
      const before = r.status;
      if (String(data.status).endsWith('완료')) {
        const lines = requestItems(r),
          actuals = Array.isArray(data.actuals)
            ? data.actuals
            : lines.length === 1
              ? [{ sku: lines[0].sku, actual: data.actual }]
              : [];
        if (
          actuals.length !== lines.length ||
          new Set(actuals.map((x: any) => x.sku)).size !== lines.length
        )
          fail('모든 상품의 실수량을 각각 입력해 주세요.');
        const checked = lines.map((x) => {
          const raw = actuals.find((v: any) => v.sku === x.sku)?.actual;
          const qty = Number(raw);
          if (
            raw === undefined ||
            raw === null ||
            raw === '' ||
            !Number.isInteger(qty) ||
            qty < 0 ||
            qty > 1000000
          )
            fail('실제 입출고 수량을 0 이상의 정수로 입력해 주세요.');
          if (r.type === '출고' && !(x.qty === 0 && qty === 0) && inventoryStock(s, x.sku) === null)
            fail(`${x.sku} 재고가 아직 확인되지 않았습니다.`);
          if (r.type === '출고' && stock(s, x.sku) < qty)
            fail(`${x.sku} 재고가 부족합니다. 현재 ${stock(s, x.sku)}개입니다.`);
          return { ...x, actual: qty };
        });
        if (s.movements.some((m) => m.requestId === r.id)) fail('이미 재고에 반영된 요청입니다.');
        r.actual = checked.reduce((n, x) => n + x.actual, 0);
        r.items = checked;
        s.movements.push(
          ...checked
            .filter((x) => !(x.qty === 0 && x.actual === 0))
            .map((x) => ({
              id: uid('MOV-'),
              sku: x.sku,
              qty: r.type === '입고' ? x.actual : -x.actual,
              type: r.type,
              project: r.project,
              requestId: r.id,
              actor: actor.id,
              at: iso(),
              memo: String(data.memo || '실수량 확인 후 완료'),
            })),
        );
      }
      r.status = data.status;
      r.version++;
      log(
        '상태 변경',
        r.id,
        before,
        r.status + (r.actual !== undefined ? ` · 실수량 ${r.actual}개` : ''),
      );
      notify('프로젝트 상태 변경', r.project + ' · ' + r.status);
      break;
    }
    case 'notify': {
      if (!String(data.message || '').trim()) fail('담당자에게 전달할 내용을 입력해 주세요.');
      notify('물류팀 요청사항', String(data.message).slice(0, 1000));
      log('담당자 통지', data.id || '물류 운영팀', '', data.message);
      break;
    }
    case 'retry-notice': {
      requireStaff();
      const n = s.notices.find((n) => n.id === data.id);
      if (!n) fail('알림을 찾을 수 없습니다.');
      n!.attempts++;
      n!.status = 'Slack 미연결 · 대기 유지';
      log('알림 재처리', n!.id, '대기', '연결 미설정 · 대기 유지');
      break;
    }
    case 'contract': {
      requireAdmin();
      const c = s.contracts.find((c) => c.id === data.id);
      if (!c) fail('계약을 찾을 수 없습니다.');
      if (!data.reason?.trim()) fail('계약 변경 사유를 입력해 주세요.');
      const before = { ...c };
      for (const key of [
        'base',
        'labor',
        'overseasLabor',
        'material',
        'free',
        'extra',
        'cap',
      ] as const) {
        const value = Number(data[key]);
        if (!Number.isInteger(value) || value < 0 || value > 10000000)
          fail('계약 금액·수량은 0 이상의 정수로 입력해 주세요.');
      }
      for (const key of [
        'base',
        'labor',
        'overseasLabor',
        'material',
        'free',
        'extra',
        'cap',
      ] as const)
        c![key] = Number(data[key]);
      c!.version++;
      log('계약 정보 변경', c!.name, before, { ...c, reason: data.reason });
      break;
    }
    case 'tariff': {
      requireAdmin();
      const country = String(data.country || '').toUpperCase();
      const weight = Number(data.weight),
        a = Number(data.a),
        b = Number(data.b);
      if (
        !/^[A-Z]{2}$/.test(country) ||
        country === 'KR' ||
        ![weight, a, b].every(Number.isInteger) ||
        weight <= 0 ||
        a <= 0 ||
        b <= 0 ||
        !data.reason?.trim()
      )
        fail('국가코드·양의 정수 무게·운임과 변경 사유를 입력해 주세요.');
      const t = s.tariffs.find((t) => t.country === country && t.weight === weight);
      const before = t ? { ...t } : '';
      if (t) Object.assign(t, { a, b });
      else s.tariffs.push({ country, weight, a, b });
      log('국가·무게 운임 변경', `${country}/${weight}g`, before, { a, b, reason: data.reason });
      break;
    }
    case 'inventory': {
      requireStaff();
      const p = s.products.find((p) => p.sku === data.sku);
      if (!p) fail('상품을 찾을 수 없습니다.', 404);
      const barcode = String(data.barcode || '').trim(),
        category = String(data.category || '').trim(),
        center = String(data.center || '').trim(),
        reason = String(data.reason || '').trim(),
        beforeQty = inventoryStock(s, p!.sku);
      if (
        barcode.length > 80 ||
        !category ||
        category.length > 100 ||
        !center ||
        center.length > 120 ||
        !reason ||
        reason.length > 1000
      )
        fail('상품 속성·보관 물류창고·변경 사유를 확인해주세요.');
      const qty = data.qty === null || data.qty === '' ? null : Number(data.qty);
      if (qty === null && beforeQty !== null) fail('확인된 재고는 숫자로 입력해주세요.');
      if (qty !== null && (!Number.isInteger(qty) || qty < 0 || qty > 100000000))
        fail('현재 재고는 0 이상의 정수로 입력해주세요.');
      const before = {
        barcode: p!.barcode || '',
        category: p!.category,
        center: p!.center,
        qty: beforeQty,
      };
      const adjustment =
        qty !== null && (beforeQty === null || qty !== beforeQty)
          ? {
              id: uid('ADJ-'),
              sku: p!.sku,
              qty: qty - (beforeQty ?? 0),
              type: '재고 조정',
              project: p!.project,
              requestId: '-',
              actor: actor.id,
              at: iso(),
              memo: reason,
            }
          : null;
      Object.assign(p!, { barcode, category, center });
      if (adjustment) s.movements.push(adjustment);
      log('인벤토리 정보 수정', p!.sku, before, { barcode, category, center, qty, reason });
      break;
    }
    case 'product': {
      requireAdmin();
      const p = s.products.find((p) => p.sku === data.sku);
      if (!p) fail('상품을 찾을 수 없습니다.');
      const capacity = Number(data.capacity),
        chargeWeight = Number(data.chargeWeight);
      if (
        !Number.isInteger(capacity) ||
        capacity < 1 ||
        capacity > 15000 ||
        !Number.isInteger(chargeWeight) ||
        chargeWeight < 1 ||
        !data.reason?.trim()
      )
        fail('박스당 수량·청구무게·변경 사유를 확인해 주세요.');
      const before = { ...p };
      p!.capacity = capacity;
      p!.chargeWeight = chargeWeight;
      log('상품 기준정보 변경', p!.sku, before, { ...p, reason: data.reason });
      break;
    }
    case 'recurring-toggle': {
      requireAdmin();
      const x = s.recurring.find((x) => x.id === data.id);
      if (!x) fail('상시판매 설정을 찾을 수 없습니다.');
      x!.enabled = !x!.enabled;
      log('상시판매 설정 변경', x!.id, '', x!.enabled ? '활성' : '일시 중지');
      break;
    }
    case 'recurring-run': {
      requireStaff();
      const x = s.recurring.find((x) => x.id === data.id)!;
      if (!x || !x.enabled) fail('활성화된 상시판매 설정을 선택해 주세요.');
      if (x.lastRun === today())
        fail('오늘 이미 가공 작업을 생성했습니다. 중복 생성을 방지했습니다.');
      x.lastRun = today();
      log('상시판매 작업 생성', x.id, '', `${x.name} · 입력 주문서 업로드 대기`);
      notify('상시판매 가공 준비', x.name + ' · 자동화 화면에서 CSV를 업로드해 주세요.');
      break;
    }
    case 'automation': {
      requireStaff();
      if (!String(data.project || '').trim()) fail('프로젝트 이름을 입력해 주세요.');
      const result = transform(s, data);
      const j = {
        id: uid('JOB-'),
        at: iso(),
        mode: data.mode,
        project: String(data.project).slice(0, 120),
        input: data,
        result,
        revision: 1,
      };
      s.jobs.unshift(j);
      log('주문서 가공', j.id, '', `${result.boxCount}박스 · ${result.qty}개`);
      break;
    }
    case 'reprocess': {
      requireStaff();
      const j = s.jobs.find((j) => j.id === data.id);
      if (!j) fail('작업을 찾을 수 없습니다.');
      const result = transform(s, j!.input);
      const next = {
        ...j!,
        id: uid('JOB-'),
        at: iso(),
        result,
        revision:
          Math.max(
            ...s.jobs
              .filter((x) => x.project === j!.project && x.mode === j!.mode)
              .map((x) => x.revision),
          ) + 1,
        parent: j!.id,
      };
      s.jobs.unshift(next);
      log('주문서 재처리', next.id, j!.id, `개정 ${next.revision} · 원본 보존`);
      break;
    }
    default:
      fail('지원하지 않는 동작입니다.');
  }
  return s;
}
export function visibleState(s: State) {
  const actor = s.actors.find((a) => a.id === s.actorId)!;
  if (actor.role !== 'requester') return s;
  const visible = new Set(
    s.requests.filter((r) => r.owner === actor.id || r.status !== '입력완료').map((r) => r.id),
  );
  return {
    ...s,
    requests: s.requests.filter((r) => visible.has(r.id)),
    changes: s.changes.filter((c) => c.owner === actor.id),
    audits: s.audits.filter((l) => visible.has(l.target) || l.actor === actor.id),
    jobs: [],
    contracts: [],
    tariffs: [],
    recurring: [],
    notices: s.notices.filter((n) => n.title.startsWith('프로젝트 승인')),
  };
}
