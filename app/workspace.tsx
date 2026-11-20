'use client';
import { useState, useEffect, useRef } from 'react';
import { Status, Empty, Modal, Field } from '../components/workspace/primitives';
import DemoAccountManagement from './demo-account-management';
import { newPublicDemo, applyPublicDemo, readPublicDemo } from '../lib/public-demo';
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  Package,
  Workflow,
  Repeat2,
  SlidersHorizontal,
  History,
  ChevronRight,
  ChevronLeft,
  Plus,
  Search,
  Bell,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUpFromLine,
  ArrowDownToLine,
  MoreHorizontal,
  Check,
  CheckCheck,
  Clock,
  ArrowRight,
  X,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  Send,
  ShieldCheck,
  UserRound,
  LogOut,
  CheckCircle2,
  Settings2,
  ExternalLink,
  Truck,
  Box,
  ChevronDown,
  Layers,
  Command,
  Menu,
  Filter,
  ArrowRightLeft,
  MessageSquare,
  FileClock,
  CheckSquare,
  LoaderCircle,
  Info,
  Copy,
  Hash,
} from 'lucide-react';
import OrderAutomation from './order-automation';
import DemoGuide, { GuideCase, guideSteps } from './demo-guide';
import AccountManagement from './account-management';
import CompanyCalendar from './company-calendar';
import RequestForm, { requestForm } from './request-form';
import {
  projectCenters,
  requestItems,
  projectNum,
  State,
  RequestItem,
  Product,
  Job,
  stock,
  inventoryStock,
  inventoryStatus,
  productCategories,
  roleLabel,
  today,
  matchesRequestFilter,
  outboundShortages,
} from '../lib/model';
const names: Record<string, string> = {
  dashboard: '대시보드',
  requests: '입출고 프로젝트 보기',
  calendar: '일정 캘린더',
  inventory: '인벤토리',
  automation: '주문서 자동화',
  recurring: '상시판매',
  contracts: '계약·운임 관리',
  history: '히스토리',
  accounts: '계정 관리',
};
const nav = [
  ['dashboard', LayoutDashboard],
  ['requests', ClipboardList],
  ['calendar', CalendarDays],
  ['inventory', Package],
  ['automation', Workflow],
  ['recurring', Repeat2],
  ['contracts', SlidersHorizontal],
  ['history', History],
  ['accounts', ShieldCheck],
] as const;
const number = (v: number) => Number(v || 0).toLocaleString('ko-KR');
const dateLabel = (v: string) =>
  new Date(v).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
const timeLabel = (v: string) =>
  new Date(v).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function Workspace({ publicDemo = false }: { publicDemo?: boolean }) {
  const [state, setState] = useState<State | null>(null),
    [revision, setRevision] = useState(0),
    [page, setPage] = useState('dashboard'),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('전체'),
    [modal, setModal] = useState<any>(null),
    [drawer, setDrawer] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(''),
    [accountOpen, setAccountOpen] = useState(false),
    [mobile, setMobile] = useState(false),
    [month, setMonth] = useState(new Date().getMonth()),
    [year, setYear] = useState(new Date().getFullYear()),
    [selectedDay, setSelectedDay] = useState(''),
    [fatal, setFatal] = useState(''),
    [mineOnly, setMineOnly] = useState(true),
    [commentDraft, setCommentDraft] = useState('');
  const [demo, setDemo] = useState(true);
  const [guideVisible, setGuideVisible] = useState(publicDemo),
    [guideWelcome, setGuideWelcome] = useState(publicDemo),
    [guideKind, setGuideKind] = useState<GuideCase | null>(null),
    [guideIndex, setGuideIndex] = useState(0),
    [guideName, setGuideName] = useState(''),
    [guideBaseline, setGuideBaseline] = useState(0),
    [guideRequestChecked, setGuideRequestChecked] = useState(false),
    [accountPreview, setAccountPreview] = useState('');

  const actor = state?.actors.find((a) => a.id === state.actorId),
    staff = actor?.role !== 'requester',
    admin = actor?.role === 'admin';
  async function load() {
    try {
      if (publicDemo) {
        let next;
        try {
          next = readPublicDemo(localStorage.getItem('knowmerce-public-demo-v1'));
        } catch {
          next = newPublicDemo();
        }
        setState(next);
        setDemo(true);
        setFatal('');
        return;
      }
      const r = await fetch('/api/workspace', { cache: 'no-store' });
      const d: any = await r.json();
      if (r.status === 401) {
        window.location.assign('/login');
        return;
      }
      if (!r.ok) throw Error(d.error);
      setState(d.state);
      setRevision(d.revision);
      setDemo(d.demo !== false);
      setFatal('');
    } catch (e: any) {
      setFatal(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 4200);
      return () => clearTimeout(t);
    }
  }, [toast]);
  function move(p: string) {
    setPage(p);
    setSearch('');
    setFilter('전체');
    setMobile(false);
    setDrawer(null);
  }
  async function mutate(action: string, data: any, success = '변경사항을 저장했습니다.') {
    if (busy) return false;
    setBusy(true);
    try {
      if (publicDemo) {
        if (!state) throw Error('체험 데이터를 불러와주세요.');
        const next = applyPublicDemo(state, action, data);
        localStorage.setItem('knowmerce-public-demo-v1', JSON.stringify(next));
        setState(next);
        setRevision(revision + 1);
        setModal(null);
        setToast(success);
        return next;
      }
      const r = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data, revision }),
      });
      const d: any = await r.json();
      if (!r.ok) {
        if (r.status === 401) {
          window.location.assign('/login');
          return false;
        }
        if (r.status === 409) await load();
        throw Error(d.error);
      }
      setState(d.state);
      setRevision(d.revision);
      setDemo(d.demo !== false);
      setModal(null);
      setToast(success);
      return d.state as State;
    } catch (e: any) {
      setModal((previous: any) => ({
        type: 'error',
        title: '처리할 수 없습니다',
        message: e.message,
        returnTo: previous?.type === 'error' ? previous.returnTo : previous,
      }));
      return false;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setMineOnly(actor?.role === 'requester');
  }, [actor?.id, actor?.role]);
  useEffect(() => {
    setCommentDraft('');
  }, [drawer?.id]);
  const product = (sku: string) => state?.products.find((p) => p.sku === sku);
  const person = (id: string) => state?.actors.find((a) => a.id === id)?.name || id;
  const requestRows =
    state?.requests.filter(
      (r) =>
        (!mineOnly || r.owner === actor?.id) &&
        matchesRequestFilter(state!, r, filter) &&
        (!search ||
          [
            r.project,
            r.id,
            String(projectNum(r)),
            ...requestItems(r).flatMap((x) => [
              x.sku,
              product(x.sku)?.name,
              product(x.sku)?.project,
            ]),
            person(r.owner),
          ]
            .join(' ')
            .toLowerCase()
            .includes(search.toLowerCase())),
    ) || [];
  const approved = state?.requests.filter((r) => r.approved && r.status !== '취소') || [];
  const changes = state?.changes.filter((c) => c.status === '대기') || [];
  const pending = state?.requests.filter((r) => matchesRequestFilter(state!, r, '승인대기')) || [];
  function csvDownload(rows: any[], name: string) {
    const cols = Object.keys(rows[0] || {});
    const quote = (s: any) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
    const csv =
      '\uFEFF' +
      [cols.map(quote).join(','), ...rows.map((r) => cols.map((c) => quote(r[c])).join(','))].join(
        '\r\n',
      );
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  function openRequestDetail(id: string) {
    setDrawer({ type: 'request', id });
    if (
      publicDemo &&
      guideVisible &&
      guideIndex === 3 &&
      ['inbound', 'outbound'].includes(guideKind || '') &&
      actor?.role === 'staff' &&
      state?.requests.find((r) => r.id === id)?.project === guideName
    )
      setGuideRequestChecked(true);
  }
  function guideRequest() {
    return state?.requests.find((r) => r.project === guideName);
  }
  async function guideRole(role: 'requester' | 'staff' | 'admin') {
    if (!state || !publicDemo) return;
    const target = state.actors.find((a) => a.role === role && !a.login);
    if (target && target.id !== state.actorId)
      await mutate('switch', { actorId: target.id }, roleLabel[role] + ' 역할로 전환했습니다.');
    setAccountOpen(false);
  }
  async function openGuideStep(kind: GuideCase, index: number, name = guideName) {
    if (!state) return;
    setModal(null);
    setDrawer(null);
    setSearch('');
    setFilter('전체');
    setMobile(false);
    const r = state.requests.find((r) => r.project === name);
    if (kind === 'inbound' || kind === 'outbound') {
      if (index <= 2) {
        await guideRole('requester');
        if (index === 0) {
          move('inventory');
          setSearch('300001');
        } else if (index === 1) {
          if (r) {
            move('requests');
            setDrawer({ type: 'request', id: r.id });
          } else {
            const f = requestForm();
            Object.assign(f, {
              type: kind === 'inbound' ? '입고' : '출고',
              project: name,
              inboundAttribute: kind === 'inbound' ? '창고 최초 입고' : '',
              reason: kind === 'outbound' ? '판매(고객/회사등)' : '',
              recipient: '가이드 수령인',
              phone: '010-0000-0000',
              address: '서울특별시 가이드 예시 주소',
              note: '가이드 가상 데이터 · 실제 발송 없음',
            });
            f.items[0] = { sku: '300001', qty: 10, barcode: '' };
            setModal({ type: 'request', form: f });
          }
        } else {
          move('requests');
          if (r) setDrawer({ type: 'request', id: r.id });
        }
      } else if (index === 3) {
        move('dashboard');
      } else if (index === 4) {
        move('calendar');
      } else if (index === 6) {
        move('inventory');
        setDrawer({ type: 'product', sku: '300001' });
      } else {
        await guideRole('staff');
        move('requests');
        setMineOnly(false);
        if (r) setDrawer({ type: 'request', id: r.id });
      }
    } else if (kind === 'product') {
      if (index === 0) {
        await guideRole('requester');
        move('inventory');
        setModal({
          type: 'issue',
          form: {
            ownership: '자사',
            project: name,
            items: [
              { name: '체험 응원봉', barcode: '', category: productCategories[0] },
              ...Array.from({ length: 4 }, () => ({ name: '', barcode: '', category: '' })),
            ],
          },
        });
      } else {
        if (index === 2) await guideRole('staff');
        move('inventory');
        const p = state.products.find((p) => p.project === name);
        if (p) setDrawer({ type: 'product', sku: p.sku });
      }
    } else if (kind === 'change') {
      await guideRole(index === 1 ? 'staff' : 'requester');
      move('requests');
      setMineOnly(false);
      if (index !== 1) {
        const target = state.requests.find((r) => r.id === 'REQ-1028');
        if (target) setDrawer({ type: 'request', id: target.id });
      }
    } else if (kind === 'accounts') {
      await guideRole('admin');
      move('accounts');
    } else if (kind === 'album' || kind === 'md') {
      await guideRole('staff');
      if (page !== 'automation') move('automation');
    } else {
      await guideRole('admin');
      move(index === 0 ? 'contracts' : 'recurring');
    }
  }
  async function chooseGuide(kind: GuideCase) {
    const name =
      '가이드 · ' +
      (kind === 'outbound' ? '출고' : kind === 'product' ? '신규 상품' : '입고') +
      ' ' +
      new Date().toLocaleTimeString('ko-KR', { hour12: false });
    setGuideName(name);
    setGuideRequestChecked(false);
    setAccountPreview('');
    setGuideBaseline(kind === 'product' ? state!.audits.length : state!.jobs.length);
    setGuideKind(kind);
    setGuideIndex(0);
    setGuideWelcome(false);
    setGuideVisible(true);
    await openGuideStep(kind, 0, name);
  }
  function guideDone() {
    if (!state || !guideKind) return false;
    const r = guideRequest();
    if (guideKind === 'accounts') return accountPreview === (guideIndex === 0 ? 'create' : 'reset');
    if (guideKind === 'inbound' || guideKind === 'outbound')
      return guideIndex === 1
        ? !!r
        : guideIndex === 2
          ? !!r && r.status !== '입력완료'
          : guideIndex === 3
            ? actor?.role === 'staff' && guideRequestChecked && !!r?.approved
            : guideIndex === 5
              ? !!r?.status.endsWith('완료')
              : true;
    if (guideKind === 'product') {
      const p = state.products.find((p) => p.project === guideName);
      return guideIndex === 0
        ? !!p
        : guideIndex === 2
          ? !!p && state.audits.some((a) => a.target === p.sku && a.action === '인벤토리 정보 수정')
          : true;
    }
    if (guideKind === 'change')
      return guideIndex === 0
        ? state.changes.some((c) => c.requestId === 'REQ-1028')
        : guideIndex === 1
          ? state.changes.some((c) => c.requestId === 'REQ-1028' && c.status === '승인')
          : true;
    if (guideKind === 'album' || guideKind === 'md')
      return guideIndex === 2
        ? state.jobs.length > guideBaseline && state.jobs.some((j) => j.mode === guideKind)
        : true;
    return true;
  }
  function guideStepForView() {
    if (!guideKind) return undefined;
    const step = guideSteps(guideKind)[guideIndex];
    if (!['inbound', 'outbound'].includes(guideKind) || guideIndex !== 3) return step;
    if (actor?.role !== 'staff')
      return {
        ...step,
        title: '물류 담당자로 직접 전환 · 요청 확인 · 승인',
        target: '.demo-role-buttons',
      };
    if (!guideRequestChecked)
      return {
        ...step,
        title: '물류 담당자 · 알림이나 대기 요청 확인',
        body: '물류 담당자로 전환했습니다. 상단 종 모양 알림을 누르고 방금 제출한 요청의 ‘요청 확인’을 누르세요. 또는 대시보드 ‘확인이 필요한 요청’에서 해당 요청 행을 클릭하세요.',
        target: '.requests-panel, .notification-btn',
      };
    return {
      ...step,
      title: '물류 담당자 · 요청 내용 확인 후 승인',
      body: '방금 제출한 요청의 상품·수량·일정을 확인하세요. 상세 화면에서 스크롤을 내려 ‘프로젝트 승인·일정 등록’을 누른 뒤 ‘확인·진행’을 누르세요. 승인이 완료되면 5/7 일정 확인으로 자동 이동합니다.',
      target: '.drawer',
    };
  }
  function newIssuance() {
    setModal({
      type: 'issue',
      form: {
        ownership: '자사',
        project: '',
        items: Array.from({ length: 5 }, () => ({ name: '', barcode: '', category: '' })),
      },
    });
  }
  function issueCell(index: number, key: string, value: string) {
    setModal((m: any) => ({
      ...m,
      form: {
        ...m.form,
        items: m.form.items.map((row: any, i: number) =>
          i === index ? { ...row, [key]: value } : row,
        ),
      },
    }));
  }
  async function issueCodes() {
    const existing = new Set(state!.products.map((p) => p.sku));
    const result = await mutate(
      'issue-codes',
      modal.form,
      '물류코드 발번과 인벤토리 등록을 완료했습니다.',
    );
    if (result) {
      const issued = result.products.filter((p) => !existing.has(p.sku));
      setModal({ type: 'issued', products: issued });
    }
  }
  async function copyCodes(products: Product[]) {
    const clean = (v: any) => String(v ?? '').replace(/[\t\r\n]/g, ' ');
    const text = [
      ['상품이름', '품번', '프로젝트', '소유권', '바코드', '상품 분류'].join('\t'),
      ...products.map((p) =>
        [p.name, p.sku, p.project, p.ownership, p.barcode, p.category].map(clean).join('\t'),
      ),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setToast('발번 결과를 복사했습니다. 시트의 첫 행에 붙여넣어 주세요.');
    } catch {
      setModal({ type: 'copy', text, products });
    }
  }
  function newRequest() {
    setModal({ type: 'request', form: requestForm() });
  }
  function openDirect(confirmStock = false) {
    setModal({
      type: 'confirm',
      title: '바로요청하시겠습니까?',
      message: '요청이 진행되면 수정이 어렵습니다. 그래도 바로 요청하시겠습니까?',
      action: 'direct-request',
      data: { ...modal.form, confirmStock },
      navigateProjects: true,
      returnTo: modal.previous || modal,
      direct: true,
      success: '물류팀에 바로 요청했습니다.',
    });
  }
  function shortageMessage(r: any) {
    return outboundShortages(state!, r)
      .map((x) => {
        const n = inventoryStock(state!, x.sku);
        return (
          (product(x.sku)?.name || x.sku) +
          ' · 요청 ' +
          number(x.qty) +
          '개 / 현재 재고 ' +
          (n === null ? '미확인' : number(n) + '개')
        );
      })
      .join('\n');
  }
  function checkOutbound(next: 'save' | 'direct') {
    if (next === 'save') {
      performSaveRequest();
      return;
    }
    const f = modal.form;
    const invalid = (f.items || []).some(
      (x: any) =>
        (x.sku || String(x.qty ?? '') || x.barcode) &&
        (!product(x.sku) || !Number.isInteger(Number(x.qty)) || Number(x.qty) < 1),
    );
    const message = !invalid ? shortageMessage(f) : '';
    if (message) {
      setModal({ type: 'stock-warning', form: f, previous: modal, next: 'direct', message });
      return;
    }
    openDirect();
  }
  async function performSaveRequest() {
    const before = new Set(state!.requests.map((r) => r.id));
    const edit = modal.edit || modal.previous?.edit;
    const result = await mutate(
      edit ? 'edit' : 'save-draft',
      modal.form,
      edit ? '요청 정보를 수정했습니다.' : '입력완료로 저장했습니다.',
    );
    if (result) {
      const r = modal.form.id
        ? result.requests.find((x) => x.id === modal.form.id)
        : result.requests.find((x) => !before.has(x.id));
      if (r) {
        setDrawer({ type: 'request', id: r.id });
        if (!edit) {
          setModal({ type: 'saved', request: r });
          if (
            publicDemo &&
            guideVisible &&
            guideIndex === 1 &&
            (guideKind === 'inbound' || guideKind === 'outbound')
          ) {
            setGuideName(r.project);
            setGuideIndex(2);
          }
        }
      }
    }
  }
  async function submitDraft(r: RequestItem, confirmStock = false) {
    const message = shortageMessage(r);
    if (message && !confirmStock) {
      setModal({ type: 'stock-warning', form: r, previous: null, next: 'submit', message });
      return;
    }
    const result = await mutate(
      'submit-draft',
      { id: r.id, version: r.version, confirmStock },
      '물류팀에 요청했습니다.',
    );
    if (result) move('requests');
  }
  function deleteDraft(r: RequestItem) {
    setModal({
      type: 'confirm',
      title: '저장한 프로젝트를 삭제할까요?',
      message: r.project + '\n입력완료 건을 삭제합니다. 삭제 이력은 보존됩니다.',
      action: 'delete-draft',
      data: { id: r.id, version: r.version },
      success: '입력완료 프로젝트를 삭제했습니다.',
    });
  }
  function editRequest(r: RequestItem) {
    setModal({ type: 'request', edit: r.status !== '입력완료', form: requestForm(r) });
  }
  const formValue = (key: string, value: any) =>
    setModal((m: any) => ({ ...m, form: { ...m.form, [key]: value } }));
  function approval(r: RequestItem) {
    setModal({
      type: 'confirm',
      title: '프로젝트를 승인할까요?',
      message: `${r.project} · ${r.date}\n승인 시 슬랙 논의 중으로 변경되고 전사 일정에 반영됩니다. 재고는 실제 입출고 완료 시 반영됩니다.`,
      action: 'approve',
      data: { id: r.id },
      success: '승인했습니다. 슬랙 논의 중으로 변경하고 전사 일정에 등록했습니다.',
    });
  }
  function requestTable(rows: RequestItem[], compact = false) {
    return rows.length ? (
      <div className="table-wrap">
        <table className="project-list">
          <thead>
            <tr>
              <th>Num</th>
              <th>물류 요청 이름</th>
              <th>3PL 업체</th>
              {!compact && <th>상품 이름</th>}
              <th>요청자</th>
              <th>일시</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const lines = requestItems(r);
              return (
                <tr
                  key={r.id}
                  onClick={() => openRequestDetail(r.id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openRequestDetail(r.id);
                  }}
                >
                  <td className="muted">{projectNum(r) || '—'}</td>
                  <td>
                    <div className="project-cell">
                      <span className={'project-icon ' + (r.type === '입고' ? 'mint' : 'lilac')}>
                        {r.type === '입고' ? (
                          <ArrowDownToLine size={17} />
                        ) : (
                          <ArrowUpFromLine size={17} />
                        )}
                      </span>
                      <div>
                        <b className="project-name">{r.project}</b>
                        <small>
                          {r.type} · {number(r.qty)}개
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{projectCenters(state!, r).join(' / ')}</td>
                  {!compact && (
                    <td>
                      <div className="cell-stack">
                        <span>{product(lines[0].sku)?.name}</span>
                        {lines.length > 1 && <small>외 {lines.length - 1}건</small>}
                      </div>
                    </td>
                  )}
                  <td>{person(r.owner)}</td>
                  <td className="nowrap">
                    {r.date}
                    {r.time && <small className="block">{r.time}</small>}
                  </td>
                  <td>
                    <Status value={r.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty />
    );
  }
  if (!state)
    return (
      <div className="loading-screen">
        <div className="brand-mark">K</div>
        <h1>
          KNOWMERCE <span>Flow</span>
        </h1>
        {fatal ? (
          <>
            <p>{fatal}</p>
            <button className="primary" onClick={load}>
              다시 불러오기
            </button>
            <a href="/login">검토용 사이트 로그인</a>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" />
            <p>워크스페이스를 준비하고 있어요.</p>
          </>
        )}
      </div>
    );
  const inventoryFiltered = state.products
    .map((p, index) => ({ p, index }))
    .sort((a, b) => (b.p.createdAt || '').localeCompare(a.p.createdAt || '') || a.index - b.index)
    .map((x) => x.p)
    .filter((p) =>
      [p.name, p.sku, p.project, p.category].join(' ').toLowerCase().includes(search.toLowerCase()),
    );
  const counts = {
    pending: pending.length,
    changes: changes.length,
    shipping: state.requests.filter((r) => ['배송 중', '출고중'].includes(r.status)).length,
    discussion: state.requests.filter((r) => r.status === '슬랙 논의 중').length,
    issues: state.requests.filter((r) => r.status === '이슈 해결 중').length,
  };
  const drawerRequest =
    drawer?.type === 'request' ? state.requests.find((r) => r.id === drawer.id) : null;
  const drawerProduct =
    drawer?.type === 'product' ? state.products.find((p) => p.sku === drawer.sku) : null;
  const monthDays = new Date(year, month + 1, 0).getDate(),
    startWeek = new Date(year, month, 1).getDay();
  return (
    <div className={'app-shell ' + (guideVisible && !guideWelcome ? 'guide-active' : '')}>
      {mobile && <div className="sidebar-shade" onClick={() => setMobile(false)} />}
      <aside className={'sidebar ' + (mobile ? 'open' : '')}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            move('dashboard');
          }}
        >
          <span className="brand-mark">K</span>
          <b>
            KNOWMERCE <em>Flow</em>
          </b>
        </a>
        <button className="workspace-switch" onClick={() => setAccountOpen(!accountOpen)}>
          <span className="workspace-dot">K</span>
          <span>
            <b>Knowmerce 물류 워크스페이스</b>
            <small>통합 물류 관리</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {nav
            .filter(
              ([id]) =>
                (id !== 'accounts' || admin) &&
                (staff || !['automation', 'recurring', 'contracts'].includes(id)),
            )
            .map(([id, Icon]) => (
              <button key={id} className={page === id ? 'active' : ''} onClick={() => move(id)}>
                <Icon size={18} />
                <span>{names[id]}</span>
                {id === 'requests' && pending.length > 0 && <small>{pending.length}</small>}
                {id === 'automation' && <em>NEW</em>}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          {publicDemo && (
            <div className="demo-role-buttons">
              <small>체험 역할</small>
              {(['requester', 'staff', 'admin'] as const).map((role) => (
                <button
                  key={role}
                  className={actor!.role === role ? 'active' : ''}
                  onClick={async () => {
                    await guideRole(role);
                    move('dashboard');
                  }}
                >
                  {roleLabel[role]}
                </button>
              ))}
              <button
                className="guide-restart"
                onClick={() => {
                  setGuideVisible(true);
                  setGuideKind(null);
                  setGuideWelcome(false);
                }}
              >
                주요 플로우 가이드 ↗
              </button>
            </div>
          )}
          <div className="connection-card">
            <span className="online-dot" />
            <b>{publicDemo ? '로그인 없는 공개 체험' : '워크스페이스 연결됨'}</b>
            <p>
              {publicDemo
                ? '변경사항은 이 브라우저에만 저장됩니다.'
                : '요청과 변경사항이 저장됩니다.'}
            </p>
          </div>
          <button className="account" onClick={() => setAccountOpen(!accountOpen)}>
            <span className="avatar">{actor!.name.slice(0, 1)}</span>
            <div>
              <b>{actor!.name}</b>
              <small>{roleLabel[actor!.role]}</small>
            </div>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="메뉴 열기"
            >
              <Menu size={20} />
            </button>
            <span>워크스페이스</span>
            <ChevronRight size={13} />
            <b>{page === 'dashboard' && !staff ? '요청자 홈' : names[page]}</b>
          </div>
          <div className="top-actions">
            <span className="prototype-label">
              PROTOTYPE <i /> 예시 데이터
            </span>
            <button
              className="icon-btn notification-btn"
              aria-label="알림"
              onClick={() => setModal({ type: 'notices' })}
            >
              <Bell size={19} />
              {state.notices.length > 0 && <i />}
            </button>
            <span className="top-divider" />
            <button
              className="top-avatar avatar"
              onClick={() => setAccountOpen(!accountOpen)}
              title={demo ? '체험 계정 전환' : '내 계정'}
            >
              {actor!.name.slice(0, 1)}
            </button>
          </div>
        </header>
        <div className="page-body">
          <div className="page-heading">
            <div>
              <div className="eyebrow">KNOWMERCE LOGISTICS WORKSPACE</div>
              <h1>
                {page === 'dashboard'
                  ? staff
                    ? '물류 업무를 한눈에'
                    : '필요한 물류 업무를 시작하세요'
                  : names[page]}
                {page === 'dashboard' && <span className="greeting-dot" />}
              </h1>
              <p>
                {
                  (
                    {
                      dashboard: '요청부터 출고까지, 오늘의 흐름을 확인하세요.',
                      requests: '프로젝트의 요청과 변경사항을 한곳에서 관리합니다.',
                      calendar: '승인된 프로젝트가 일정에 자동으로 연결됩니다.',
                      inventory: '상품별 현재 수량과 모든 입출고 이력을 확인하세요.',
                      automation: '반복되는 주문서 가공을 간편하게 처리하세요.',
                      recurring: '매주 반복되는 상시판매 출고 기준을 관리합니다.',
                      contracts: '배송비·작업료·국가별 운임의 기준을 관리합니다.',
                      history: '누가, 언제, 무엇을 바꾸었는지 기록합니다.',
                      accounts: '사용자 계정을 발급하고 비밀번호를 초기화합니다.',
                    } as any
                  )[page]
                }
              </p>
            </div>
            <div className="heading-actions">
              {page === 'dashboard' && (
                <span className="today-label">
                  <CalendarDays size={15} />
                  {new Date().toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </span>
              )}
              {page === 'requests' || (page === 'dashboard' && staff) ? (
                <button className="primary" onClick={newRequest}>
                  <Plus size={17} />
                  입출고 요청
                </button>
              ) : page === 'inventory' ? (
                <>
                  <button
                    className="secondary"
                    onClick={() =>
                      csvDownload(
                        state.products.map((p) => ({
                          품번: p.sku,
                          상품명: p.name,
                          현재재고: inventoryStock(state, p.sku),
                          센터: p.center,
                        })),
                        'inventory.csv',
                      )
                    }
                  >
                    <Download size={16} />
                    재고 내보내기
                  </button>
                  <button className="primary" onClick={newIssuance}>
                    <Plus size={17} />
                    물류 코드 발번
                  </button>
                </>
              ) : null}
            </div>
          </div>
          {page === 'dashboard' && !staff && (
            <>
              <div className="requester-actions">
                {[
                  {
                    label: '물류코드 검색 / 발번',
                    description: '상품을 찾고 새로운 물류코드를 발급받아요.',
                    icon: Hash,
                    color: 'lilac',
                    click: () => move('inventory'),
                  },
                  {
                    label: '입출고 신청',
                    description: '상품과 일정을 입력해 물류팀에 요청해요.',
                    icon: ClipboardList,
                    color: 'mint',
                    click: newRequest,
                  },
                  {
                    label: '입출고 프로젝트보기',
                    description: '내 요청의 진행 상태와 변경 내용을 확인해요.',
                    icon: Layers,
                    color: 'blue',
                    click: () => move('requests'),
                  },
                  {
                    label: '입출고 캘린더 상세보기',
                    description: '승인된 입출고 일정을 자세히 확인해요.',
                    icon: CalendarDays,
                    color: 'amber',
                    click: () => move('calendar'),
                  },
                ].map((x) => (
                  <button className="requester-action" key={x.label} onClick={x.click}>
                    <span className={'round-icon ' + x.color}>
                      <x.icon size={22} />
                    </span>
                    <h2>{x.label}</h2>
                    <p>{x.description}</p>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
              </div>
              <CompanyCalendar
                state={state}
                compact
                onOpen={(id) => setDrawer({ type: 'request', id })}
                onDetails={() => move('calendar')}
              />
            </>
          )}
          {page === 'dashboard' && staff && (
            <>
              <div className="stat-grid">
                {[
                  {
                    label: '승인 대기',
                    value: counts.pending,
                    desc: '담당자 확인이 필요해요',
                    icon: ClipboardList,
                    color: 'purple',
                    filter: '승인대기',
                  },
                  {
                    label: '슬랙 논의 중',
                    value: counts.discussion,
                    desc: '일정과 작업 조건을 논의해요',
                    icon: MessageSquare,
                    color: 'purple',
                    filter: '슬랙 논의 중',
                  },
                  {
                    label: '이슈 해결 중',
                    value: counts.issues,
                    desc: '문제 확인과 해결이 필요해요',
                    icon: AlertTriangle,
                    color: 'red',
                    filter: '이슈 해결 중',
                  },
                  {
                    label: '수정 요청',
                    value: counts.changes,
                    desc: '변경사항을 검토해 주세요',
                    icon: FileClock,
                    color: 'amber',
                    filter: '수정 요청',
                  },
                  {
                    label: '배송 진행 중',
                    value: counts.shipping,
                    desc: '물류의 흐름이 이어지고 있어요',
                    icon: Truck,
                    color: 'blue',
                    filter: '배송 중',
                  },
                ].map((x) => (
                  <button
                    className="stat-card"
                    key={x.label}
                    onClick={() => {
                      move('requests');
                      setMineOnly(false);
                      setFilter(x.filter);
                    }}
                  >
                    <div>
                      <span>{x.label}</span>
                      <span className={'stat-icon ' + x.color}>
                        <x.icon size={19} />
                      </span>
                    </div>
                    <strong>
                      {x.value}
                      <small>건</small>
                    </strong>
                    <p>
                      {x.desc}
                      <ArrowUpRight size={14} />
                    </p>
                  </button>
                ))}
              </div>
              <div className="dashboard-columns">
                <section className="panel requests-panel">
                  <div className="panel-header">
                    <div>
                      <h2>
                        확인이 필요한 요청 <span>{pending.length + changes.length}</span>
                      </h2>
                      <p>새 요청과 변경사항을 놓치지 마세요.</p>
                    </div>
                    <button className="text-btn" onClick={() => move('requests')}>
                      전체 보기 <ChevronRight size={15} />
                    </button>
                  </div>
                  {changes.length > 0 && (
                    <div className="change-highlight">
                      <span className="round-icon amber">
                        <FileClock size={18} />
                      </span>
                      <div>
                        <b>{state.requests.find((r) => r.id === changes[0].requestId)?.project}</b>
                        <p>수정 요청 · {changes[0].reason}</p>
                      </div>
                      <button
                        className="small-button"
                        onClick={() => setModal({ type: 'review', id: changes[0].id })}
                      >
                        검토하기
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                  {requestTable(pending.slice(0, 4), true)}
                  <div className="panel-foot">
                    <span className="online-dot" /> 승인 시 일정이 자동으로 등록됩니다.
                  </div>
                </section>
                <section className="panel schedule-card">
                  <div className="panel-header">
                    <div>
                      <h2>다가오는 일정</h2>
                      <p>승인된 입출고 일정</p>
                    </div>
                    <button
                      className="icon-btn"
                      onClick={() => move('calendar')}
                      aria-label="캘린더 보기"
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <div className="schedule-list">
                    {approved
                      .filter((r) => !r.status.endsWith('완료'))
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .slice(0, 4)
                      .map((r) => (
                        <button
                          className="schedule-item"
                          key={r.id}
                          onClick={() => setDrawer({ type: 'request', id: r.id })}
                        >
                          <span className="date-tile">
                            <small>
                              {new Date(r.date).toLocaleDateString('ko-KR', { weekday: 'short' })}
                            </small>
                            <b>{new Date(r.date).getDate()}</b>
                          </span>
                          <div>
                            <b>{r.project}</b>
                            <p>
                              <span
                                className={'type-dot ' + (r.type === '입고' ? 'mint' : 'purple')}
                              />
                              {r.type} · {number(r.qty)}개
                            </p>
                          </div>
                          <ChevronRight size={14} />
                        </button>
                      ))}
                  </div>
                  <button className="calendar-link" onClick={() => move('calendar')}>
                    <CalendarDays size={15} />
                    캘린더에서 모두 보기
                    <ArrowRight size={14} />
                  </button>
                </section>
              </div>
              <div className="dashboard-columns bottom-columns">
                <section className="automation-banner">
                  <div className="banner-illustration">
                    <div className="sheet-art">
                      <FileSpreadsheet size={33} />
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="float-check">
                      <Check size={16} />
                    </div>
                    <div className="float-arrow">
                      <ArrowRight size={17} />
                    </div>
                    <div className="box-art">
                      <Package size={32} />
                    </div>
                  </div>
                  <div>
                    <span className="mini-label">SMART WORKFLOW</span>
                    <h2>
                      엑셀 작업은 줄이고,
                      <br />
                      물류의 흐름에 집중하세요.
                    </h2>
                    <p>앨범·MD 주문서 가공부터 물류비 비교까지.</p>
                    <button
                      className="primary"
                      disabled={!staff}
                      onClick={() => move('automation')}
                    >
                      {staff ? '주문서 자동화 시작' : '물류 담당자 전용 기능'}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </section>
                <section className="panel activity-panel">
                  <div className="panel-header">
                    <h2>최근 활동</h2>
                    <button className="text-btn" onClick={() => move('history')}>
                      전체 보기
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="activity-list">
                    {state.audits.slice(0, 4).map((a) => (
                      <div key={a.id}>
                        <span className="activity-dot" />
                        <div>
                          <b>{a.action}</b>
                          <p>
                            {a.target} · {person(a.actor)}
                          </p>
                        </div>
                        <time>{timeLabel(a.at)}</time>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
          {page === 'requests' && (
            <>
              <fieldset className="project-scope">
                <legend>프로젝트 조회 범위</legend>
                <label>
                  <input
                    type="radio"
                    name="project-scope"
                    checked={mineOnly}
                    onChange={() => setMineOnly(true)}
                  />
                  내것만 보기
                </label>
                <label>
                  <input
                    type="radio"
                    name="project-scope"
                    checked={!mineOnly}
                    onChange={() => setMineOnly(false)}
                  />
                  전체보기
                </label>
                <span>3PL 업체와 진행 상태를 함께 확인하세요.</span>
              </fieldset>
              {!['전체', '승인대기', '입고', '출고', '완료', '이슈 해결 중'].includes(filter) && (
                <div className="active-project-filter">
                  <b>조회 조건: {filter}</b>
                  <button className="text-btn" onClick={() => setFilter('전체')}>
                    조건 해제 <X size={14} />
                  </button>
                </div>
              )}
              <div className="list-toolbar">
                <div className="tabs">
                  {['전체', '승인대기', '입고', '출고', '완료', '이슈 해결 중'].map((v) => (
                    <button
                      className={filter === v ? 'active' : ''}
                      onClick={() => setFilter(v)}
                      key={v}
                    >
                      {v}
                      {v === '전체' && <small>{state.requests.length}</small>}
                    </button>
                  ))}
                </div>
                <div className="search-input">
                  <Search size={16} />
                  <input
                    placeholder="요청자, 프로젝트, 품번, 상품이름 검색"
                    aria-label="입출고 내역 검색"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              {changes.length > 0 && ['전체', '수정 요청'].includes(filter) && (
                <section className="panel changes-panel">
                  <div className="panel-header">
                    <h2>
                      수정 요청 대기 <span>{changes.length}</span>
                    </h2>
                  </div>
                  {changes.map((c) => (
                    <div className="change-line" key={c.id}>
                      <span className="round-icon amber">
                        <FileClock size={17} />
                      </span>
                      <div>
                        <b>{state.requests.find((r) => r.id === c.requestId)?.project}</b>
                        <p>
                          {number(c.qty)}개 · {c.date} · {c.reason}
                        </p>
                      </div>
                      <Status value="승인 대기" />
                      <button
                        className="small-button"
                        onClick={() => setModal({ type: 'review', id: c.id })}
                      >
                        {staff ? '변경 검토' : '내용 보기'}
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  ))}
                </section>
              )}
              <section className="panel">
                <div className="panel-header">
                  <h2>
                    입출고 프로젝트 목록 <span>{requestRows.length}</span>
                  </h2>
                  <button
                    className="text-btn"
                    onClick={() =>
                      csvDownload(
                        requestRows.flatMap((r) =>
                          requestItems(r).map((x) => ({
                            Num: projectNum(r),
                            요청ID: r.id,
                            프로젝트: r.project,
                            유형: r.type,
                            품번: x.sku,
                            상품이름: product(x.sku)?.name,
                            수량: x.qty,
                            일정: r.date,
                            상태: r.status,
                          })),
                        ),
                        'requests.csv',
                      )
                    }
                  >
                    <Download size={15} />
                    내보내기
                  </button>
                </div>
                {requestTable(requestRows)}
                <div className="panel-foot">
                  전사 요청을 조회할 수 있습니다. 다른 사람이 작성한 입력완료 건은 공유되지
                  않습니다.
                </div>
              </section>
            </>
          )}
          {page === 'accounts' &&
            admin &&
            (publicDemo ? (
              <DemoAccountManagement
                key={guideKind === 'accounts' ? guideIndex : 0}
                state={state}
                onPreview={setAccountPreview}
              />
            ) : (
              <AccountManagement state={state} busy={busy} onSave={mutate} />
            ))}
          {page === 'calendar' && (
            <CompanyCalendar state={state} onOpen={(id) => setDrawer({ type: 'request', id })} />
          )}
          {page === 'inventory' && (
            <>
              <div className="inventory-summary">
                <span className="round-icon lilac">
                  <Layers size={21} />
                </span>
                <div>
                  <b>물류코드 LIST · {state.products.length}종</b>
                  <p>상품명이나 품번으로 검색하고 신규 상품을 발번하세요.</p>
                </div>
                <div className="search-input">
                  <Search size={16} />
                  <input
                    aria-label="재고 검색"
                    placeholder="상품이름, 품번, 프로젝트 검색"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <section className="panel">
                <div className="panel-header">
                  <h2>
                    인벤토리 <span>{inventoryFiltered.length}</span>
                  </h2>
                  <span className="muted small">상품을 클릭하면 입출고 이력이 열립니다.</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>상품이름</th>
                        <th>품번</th>
                        <th>프로젝트</th>
                        <th>보관 센터</th>
                        <th>현재 재고</th>
                        <th>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryFiltered.map((p) => {
                        const qty = inventoryStock(state, p.sku);
                        return (
                          <tr
                            key={p.sku}
                            onClick={() => setDrawer({ type: 'product', sku: p.sku })}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') setDrawer({ type: 'product', sku: p.sku });
                            }}
                          >
                            <td>
                              <div className="project-cell">
                                <span className="product-thumb">
                                  <Package size={20} />
                                </span>
                                <div>
                                  <b>{p.name}</b>
                                  <small>{p.category}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="sku-value">{p.sku}</span>
                            </td>
                            <td>{p.project}</td>
                            <td>{p.center}</td>
                            <td className="stock-number">
                              {qty === null ? '-' : number(qty)} <small>개</small>
                            </td>
                            <td>
                              <Status value={inventoryStatus(qty)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!inventoryFiltered.length && <Empty text="검색된 상품이 없습니다." />}
                <div className="panel-foot">
                  미확인 재고는 - 개, 확인된 재고 0은 0개로 구분합니다. 신규 발번 상품은 입고전으로
                  표시됩니다.
                </div>
              </section>
            </>
          )}
          {page === 'automation' && staff && (
            <OrderAutomation state={state} busy={busy} onSave={mutate} />
          )}
          {page === 'recurring' && staff && (
            <>
              <div className="notice-banner">
                <Repeat2 size={22} />
                <div>
                  <b>반복되는 출고, 같은 기준으로 준비하세요.</b>
                  <p>
                    상시판매 설정은 서버에 저장됩니다. 이번 프로토타입에서는 ‘작업 생성’으로 준비
                    알림을 만들며, 예약 자동 실행은 연결 전입니다.
                  </p>
                </div>
              </div>
              <div className="recurring-grid">
                {state.recurring.map((x) => (
                  <section className="panel recurring-card" key={x.id}>
                    <div className="panel-header">
                      <span className="round-icon lilac">
                        <Repeat2 size={22} />
                      </span>
                      <Status value={x.enabled ? '활성' : '일시 중지'} />
                    </div>
                    <h2>{x.name}</h2>
                    <p>
                      매주 {x.weekday} · {x.supplier}
                    </p>
                    <div className="recurring-products">
                      {x.skus.map((sku) => (
                        <div key={sku}>
                          <Package size={16} />
                          <span>{product(sku)?.name}</span>
                          <small>{product(sku)?.capacity}개/박스</small>
                        </div>
                      ))}
                    </div>
                    <div className="recurring-last">
                      <Clock size={14} />
                      {x.lastRun ? `최근 생성 ${x.lastRun}` : '아직 생성된 작업이 없습니다.'}
                    </div>
                    <div className="recurring-actions">
                      <button
                        className="primary"
                        disabled={!x.enabled || busy}
                        onClick={() =>
                          mutate(
                            'recurring-run',
                            { id: x.id },
                            '상시판매 준비 알림을 생성했습니다. 자동화에서 주문서를 업로드해 주세요.',
                          )
                        }
                      >
                        <Plus size={16} />
                        가공 작업 생성
                      </button>
                      {admin && (
                        <button
                          className="secondary"
                          onClick={() =>
                            mutate(
                              'recurring-toggle',
                              { id: x.id },
                              '상시판매 설정을 변경했습니다.',
                            )
                          }
                        >
                          {x.enabled ? '일시 중지' : '활성화'}
                        </button>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
          {page === 'contracts' && staff && (
            <>
              <div className="notice-banner">
                <ShieldCheck size={22} />
                <div>
                  <b>
                    {admin
                      ? '계약 기준을 변경하면 이력이 함께 기록됩니다.'
                      : '계약 정보를 조회하고 비용 기준을 확인하세요.'}
                  </b>
                  <p>
                    박스별 기본 배송비·작업료·부자재·추가 작업료와 국가·무게 운임을 사용합니다. 입력
                    운임은 프로토타입 예시입니다.
                  </p>
                </div>
              </div>
              <div className="contract-grid">
                {state.contracts.map((c) => (
                  <section className="panel contract-card" key={c.id}>
                    <div className="panel-header">
                      <div>
                        <span className="mini-label">LOGISTICS PARTNER {c.id.toUpperCase()}</span>
                        <h2>{c.name}</h2>
                      </div>
                      <span className="version-tag">v{c.version}</span>
                    </div>
                    <dl>
                      {[
                        ['국내 기본 배송비', c.base, '원'],
                        ['국내 기본 작업료', c.labor, '원'],
                        ['해외 기본 작업료', c.overseasLabor, '원'],
                        ['부자재 비용', c.material, '원'],
                        ['무료 처리 수량', c.free, '개'],
                        ['추가 작업료 / 개', c.extra, '원'],
                        ['추가 작업료 상한', c.cap, c.cap ? '원' : '한도 없음'],
                      ].map(([l, v, u]) => (
                        <div key={String(l)}>
                          <dt>{l}</dt>
                          <dd>
                            {v
                              ? number(Number(v))
                              : c.cap === 0 && l === '추가 작업료 상한'
                                ? ''
                                : 0}
                            {u}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <button
                      className="secondary full"
                      disabled={!admin}
                      onClick={() => setModal({ type: 'contract', form: { ...c, reason: '' } })}
                    >
                      <Settings2 size={16} />
                      {admin ? '계약 기준 수정' : '어드민만 수정 가능'}
                    </button>
                  </section>
                ))}
              </div>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>국가·무게별 해외 운임</h2>
                    <p>청구무게 500g 단위 올림 후 정확히 일치하는 구간을 조회합니다.</p>
                  </div>
                  {admin && (
                    <button
                      className="secondary"
                      onClick={() =>
                        setModal({
                          type: 'tariff',
                          form: { country: 'JP', weight: 1000, a: 0, b: 0, reason: '' },
                        })
                      }
                    >
                      <Plus size={16} />
                      운임 등록·수정
                    </button>
                  )}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>국가코드</th>
                        <th>청구무게 구간</th>
                        <th>다보내</th>
                        <th>패스트박스</th>
                        <th>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.tariffs
                        .sort((a, b) => a.country.localeCompare(b.country) || a.weight - b.weight)
                        .map((t) => (
                          <tr key={t.country + t.weight}>
                            <td>
                              <span className="country-label">{t.country}</span>
                            </td>
                            <td>{number(t.weight)}g</td>
                            <td>₩ {number(t.a)}</td>
                            <td>₩ {number(t.b)}</td>
                            <td>
                              <Status value="등록됨" />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className="panel-foot">
                  구간이 없는 국가·무게는 비용을 0원으로 확정하지 않고 확인 대상으로 표시합니다.
                </div>
              </section>
            </>
          )}
          {page === 'history' && (
            <>
              <div className="list-toolbar">
                <div className="tabs">
                  {['전체', '승인', '수정', '상태', '가공'].map((f) => (
                    <button
                      key={f}
                      className={filter === f ? 'active' : ''}
                      onClick={() => setFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="search-input">
                  <Search size={16} />
                  <input
                    aria-label="히스토리 검색"
                    placeholder="프로젝트 ID, 활동, 담당자 검색"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <section className="panel">
                <div className="panel-header">
                  <h2>
                    활동 히스토리 <span>{state.audits.length}</span>
                  </h2>
                  <span className="muted small">변경 전·후 기록 보존</span>
                </div>
                <div className="audit-timeline">
                  {state.audits
                    .filter(
                      (a) =>
                        (filter === '전체' || a.action.includes(filter)) &&
                        [a.action, a.target, person(a.actor)].join(' ').includes(search),
                    )
                    .map((a) => (
                      <div className="audit-item" key={a.id}>
                        <span className="audit-icon">
                          <History size={16} />
                        </span>
                        <div className="audit-content">
                          <div>
                            <b>{a.action}</b>
                            <time>{timeLabel(a.at)}</time>
                          </div>
                          <p>
                            {person(a.actor)} · {a.target}
                          </p>
                          <details>
                            <summary>변경 내용 확인</summary>
                            <div className="diff">
                              <div>
                                <small>변경 전</small>
                                <pre>{a.before || '신규 생성'}</pre>
                              </div>
                              <ArrowRight size={15} />
                              <div>
                                <small>변경 후</small>
                                <pre>{a.after}</pre>
                              </div>
                            </div>
                          </details>
                        </div>
                      </div>
                    ))}
                </div>
                {!state.audits.length && <Empty text="아직 기록된 활동이 없습니다." />}
              </section>
            </>
          )}
          <footer className="workspace-footer">
            <span>
              KNOWMERCE Flow <i /> Logistics, connected.
            </span>
            <button onClick={() => setModal({ type: 'notify', form: { message: '' } })}>
              <MessageSquare size={14} />
              물류팀에 요청하기
              <ArrowUpRight size={13} />
            </button>
          </footer>
        </div>
      </main>
      {accountOpen && (
        <>
          <div className="popover-shade" onClick={() => setAccountOpen(false)} />
          <div className="account-popover">
            <div className="popover-title">
              <b>{demo ? '체험 계정 전환' : '내 계정'}</b>
              <p>
                {demo
                  ? '검토용 계정에서 역할별 화면을 확인하세요.'
                  : actor!.name + ' · ' + roleLabel[actor!.role]}
              </p>
            </div>
            {(demo ? state.actors.filter((a) => !a.login) : []).map((a) => (
              <button
                key={a.id}
                className={a.id === state.actorId ? 'selected' : ''}
                onClick={async () => {
                  const result = await mutate(
                    'switch',
                    { actorId: a.id },
                    `${a.name} · ${roleLabel[a.role]} 계정으로 전환했습니다.`,
                  );
                  if (result) {
                    setAccountOpen(false);
                    move('dashboard');
                  }
                }}
              >
                <span className="avatar">{a.name.slice(0, 1)}</span>
                <div>
                  <b>
                    {a.name}
                    <small>{a.id}</small>
                  </b>
                  <p>
                    {roleLabel[a.role]} · {a.team}
                  </p>
                </div>
                {a.id === state.actorId && <Check size={17} />}
              </button>
            ))}
            <div className="account-note">
              <ShieldCheck size={15} />
              {demo
                ? '예시 데이터로 요청자·물류 담당자·어드민 역할을 체험합니다.'
                : '발급 계정의 역할은 어드민이 정한 권한으로 적용됩니다.'}
            </div>
            <button
              className="review-logout"
              onClick={async () => {
                if (publicDemo) {
                  if (!window.confirm('체험 데이터를 처음 상태로 되돌릴까요?')) return;
                  localStorage.removeItem('knowmerce-public-demo-v1');
                  setState(newPublicDemo());
                  setAccountOpen(false);
                  move('dashboard');
                  return;
                }
                const r = await fetch('/api/review-logout', { method: 'POST' });
                if (r.ok) window.location.assign('/login');
                else setToast('로그아웃하지 못했습니다. 다시 시도해주세요.');
              }}
            >
              <LogOut size={16} />
              {publicDemo ? '체험 초기화' : '로그아웃'}
            </button>
          </div>
        </>
      )}
      {(drawerRequest || drawerProduct) && (
        <div className="drawer-backdrop" onClick={() => setDrawer(null)}>
          <aside
            className="drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={drawerRequest ? '요청 상세' : '상품 이력'}
          >
            <div className="drawer-top">
              <span>{drawerRequest ? 'REQUEST DETAIL' : 'INVENTORY HISTORY'}</span>
              <button className="icon-btn" aria-label="상세 닫기" onClick={() => setDrawer(null)}>
                <X size={21} />
              </button>
            </div>
            {drawerRequest && (
              <>
                <div className="drawer-heading">
                  <small>
                    PROJECT {projectNum(drawerRequest)} · {drawerRequest.id}
                  </small>
                  <h2>{drawerRequest.project}</h2>
                  <div>
                    <Status value={drawerRequest.status} />
                    <span className="muted small">
                      {drawerRequest.status === '입력완료'
                        ? '물류팀 요청 전'
                        : drawerRequest.approved
                          ? '프로젝트 승인됨'
                          : '승인 대기'}
                    </span>
                  </div>
                </div>
                <h3 className="section-label">
                  등록 상품 · {requestItems(drawerRequest).length}건
                </h3>
                <div className="project-detail-items">
                  {requestItems(drawerRequest).map((x) => (
                    <div key={x.sku}>
                      <div>
                        <b>{product(x.sku)?.name}</b>
                        <small>
                          {x.sku} · {product(x.sku)?.project}
                        </small>
                        <small>
                          {product(x.sku)?.category} · 바코드{' '}
                          {x.barcode || product(x.sku)?.barcode || '-'}
                        </small>
                      </div>
                      <strong>
                        {number(x.qty)}개
                        {x.actual !== undefined && <small>실수량 {number(x.actual)}개</small>}
                      </strong>
                    </div>
                  ))}
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>3PL 업체</dt>
                    <dd>{projectCenters(state, drawerRequest).join(' / ')}</dd>
                  </div>
                  <div>
                    <dt>요청 유형</dt>
                    <dd>{drawerRequest.type}</dd>
                  </div>
                  {drawerRequest.type === '입고' && (
                    <>
                      <div>
                        <dt>입고방식</dt>
                        <dd>{drawerRequest.method || '-'}</dd>
                      </div>
                      <div>
                        <dt>상품 입고 속성</dt>
                        <dd>{drawerRequest.inboundAttribute || '-'}</dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt>입출고 일시</dt>
                    <dd>
                      {drawerRequest.date} {drawerRequest.time || ''}
                    </dd>
                  </div>
                  <div>
                    <dt>요청자 / 담당자</dt>
                    <dd>
                      {person(drawerRequest.owner)} / {person(drawerRequest.assignee)}
                    </dd>
                  </div>
                  <div>
                    <dt>차량정보 / 송장번호</dt>
                    <dd>{drawerRequest.transport || '-'}</dd>
                  </div>
                  <div>
                    <dt>국가(수입시)</dt>
                    <dd>{drawerRequest.country || '-'}</dd>
                  </div>
                  <div>
                    <dt>{drawerRequest.type === '출고' ? '출고 사유' : '사유'}</dt>
                    <dd>{drawerRequest.reason || '-'}</dd>
                  </div>
                  {drawerRequest.type === '출고' && (
                    <>
                      <div>
                        <dt>받는 사람</dt>
                        <dd>{drawerRequest.recipient}</dd>
                      </div>
                      <div>
                        <dt>연락처</dt>
                        <dd>{drawerRequest.phone}</dd>
                      </div>
                      <div>
                        <dt>도착지 주소</dt>
                        <dd>{drawerRequest.address}</dd>
                      </div>
                    </>
                  )}
                </dl>
                <div className="detail-note">
                  <h3>비고(특이사항)</h3>
                  <p>{drawerRequest.note || '별도 특이사항이 없습니다.'}</p>
                </div>
                <div className="drawer-actions">
                  {drawerRequest.status === '입력완료' ? (
                    <>
                      <div className="soft-info">
                        <Info size={18} />
                        <span>정보를 확인한 뒤 ‘요청’을 눌러 물류팀에 전달하세요.</span>
                      </div>
                      <button className="primary full" onClick={() => submitDraft(drawerRequest)}>
                        <Send size={17} />
                        요청
                      </button>
                      <div className="button-row">
                        <button className="secondary" onClick={() => deleteDraft(drawerRequest)}>
                          삭제
                        </button>
                        <button className="secondary" onClick={() => editRequest(drawerRequest)}>
                          수정
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {staff &&
                        !drawerRequest.approved &&
                        !['반려', '취소'].includes(drawerRequest.status) && (
                          <button className="primary full" onClick={() => approval(drawerRequest)}>
                            <CheckCircle2 size={17} />
                            프로젝트 승인·일정 등록
                          </button>
                        )}
                      {!drawerRequest.status.endsWith('완료') &&
                        !['반려', '취소'].includes(drawerRequest.status) &&
                        (staff || drawerRequest.owner === actor!.id) && (
                          <div className="button-row">
                            {staff ? (
                              <button
                                className="secondary"
                                onClick={() => editRequest(drawerRequest)}
                              >
                                <Settings2 size={15} />
                                정보 수정
                              </button>
                            ) : (
                              <button
                                className="secondary"
                                onClick={() =>
                                  setModal({
                                    type: 'change',
                                    form: {
                                      id: drawerRequest.id,
                                      qty: drawerRequest.qty,
                                      date: drawerRequest.date,
                                      reason: '',
                                      items: requestItems(drawerRequest),
                                    },
                                  })
                                }
                              >
                                <FileClock size={15} />
                                수정 요청
                              </button>
                            )}
                            <button
                              className="secondary"
                              onClick={() =>
                                setModal({
                                  type: 'notify',
                                  form: {
                                    id: drawerRequest.id,
                                    message: drawerRequest.project + ' 관련 문의: ',
                                  },
                                })
                              }
                            >
                              <Send size={15} />
                              담당자 통지
                            </button>
                          </div>
                        )}
                    </>
                  )}
                  {staff && drawerRequest.status !== '취소' && (
                    <button
                      className="secondary full"
                      onClick={() =>
                        setModal({
                          type: 'manage',
                          form: {
                            id: drawerRequest.id,
                            version: drawerRequest.version,
                            assignee: drawerRequest.assignee,
                            center: drawerRequest.center || '',
                            expectedCompletion: drawerRequest.expectedCompletion || '',
                          },
                          requestType: drawerRequest.type,
                        })
                      }
                    >
                      <Settings2 size={16} />
                      물류 정보 수정{admin ? ' · 담당자 변경' : ''}
                    </button>
                  )}
                  {staff &&
                    drawerRequest.approved &&
                    !drawerRequest.status.endsWith('완료') &&
                    drawerRequest.status !== '취소' && (
                      <>
                        <h3 className="progress-title">입출고 진행</h3>
                        <div className="status-actions logistics-progress-actions">
                          {(admin
                            ? drawerRequest.type === '입고'
                              ? ['물류팀 확인 중', '슬랙 논의 중', '입고 완료', '이슈 해결 중']
                              : [
                                  '물류팀 확인 중',
                                  '슬랙 논의 중',
                                  '배송 중',
                                  '출고중',
                                  '출고 완료',
                                  '이슈 해결 중',
                                ]
                            : drawerRequest.status === '배송 중' ||
                                drawerRequest.status === '출고중'
                              ? ['출고 완료', '이슈 해결 중']
                              : drawerRequest.type === '입고'
                                ? ['물류팀 확인 중', '슬랙 논의 중', '입고 완료', '이슈 해결 중']
                                : ['물류팀 확인 중', '슬랙 논의 중', '배송 중', '이슈 해결 중']
                          )
                            .filter((x) => x !== drawerRequest.status)
                            .sort(
                              (a, b) =>
                                Number(
                                  ['입고 완료', '배송 중', '출고 완료', '출고중'].includes(b),
                                ) -
                                Number(['입고 완료', '배송 중', '출고 완료', '출고중'].includes(a)),
                            )
                            .map((v) => (
                              <button
                                key={v}
                                className={
                                  ['입고 완료', '배송 중', '출고 완료', '출고중'].includes(v)
                                    ? 'primary progress-blue'
                                    : 'secondary'
                                }
                                onClick={() =>
                                  v.endsWith('완료')
                                    ? setModal({
                                        type: 'complete',
                                        form: {
                                          id: drawerRequest.id,
                                          status: v,
                                          actuals: requestItems(drawerRequest).map((x) => ({
                                            sku: x.sku,
                                            actual: x.qty,
                                          })),
                                          memo: '',
                                        },
                                      })
                                    : setModal({
                                        type: 'confirm',
                                        title: '진행 상태를 변경할까요?',
                                        message: `${v} 상태로 변경하고 히스토리에 기록합니다.`,
                                        action: 'status',
                                        data: { id: drawerRequest.id, status: v },
                                      })
                                }
                              >
                                {v}
                                <ArrowRight size={14} />
                              </button>
                            ))}
                        </div>
                        <button
                          className="secondary cancel-project-button"
                          onClick={() =>
                            setModal({
                              type: 'confirm',
                              title: '프로젝트 취소',
                              message:
                                '‘취소’로 변경됩니다. 맞습니까?\n취소한 프로젝트는 일정에서 제외되며 이력은 보존됩니다.',
                              action: 'status',
                              data: {
                                id: drawerRequest.id,
                                status: '취소',
                                version: drawerRequest.version,
                                confirmCancel: true,
                              },
                              success: '프로젝트를 취소했습니다.',
                            })
                          }
                        >
                          취소로 변경
                        </button>
                      </>
                    )}
                </div>
                {
                  <div className="detail-note">
                    <h3>{drawerRequest.type} 완료예상 시점</h3>
                    <p>{drawerRequest.expectedCompletion || '미등록'}</p>
                    <small>요청일과 다르면 아래 메모에 이유를 남겨주세요.</small>
                  </div>
                }
                <section className="project-comments">
                  <h3>
                    메모 <span>{drawerRequest.comments?.length || 0}</span>
                  </h3>
                  <p>논의와 일정 차이를 댓글처럼 남겨주세요.</p>
                  <div className="comment-list">
                    {(drawerRequest.comments || []).map((c) => (
                      <article key={c.id}>
                        <header>
                          <b>{person(c.actor)}</b>
                          <time>{timeLabel(c.at)}</time>
                        </header>
                        <p>{c.body}</p>
                      </article>
                    ))}
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const result = await mutate(
                        'comment',
                        { id: drawerRequest.id, body: commentDraft },
                        '메모를 등록했습니다.',
                      );
                      if (result) setCommentDraft('');
                    }}
                  >
                    <textarea
                      aria-label="프로젝트 메모"
                      placeholder="메모를 입력하세요"
                      value={commentDraft}
                      maxLength={2000}
                      rows={3}
                      onChange={(e) => setCommentDraft(e.target.value)}
                    />
                    <button className="primary" disabled={busy || !commentDraft.trim()}>
                      <MessageSquare size={16} />
                      메모 등록
                    </button>
                  </form>
                </section>
                <h3 className="section-label">프로젝트 히스토리</h3>
                <div className="mini-timeline">
                  {state.audits
                    .filter((a) => a.target === drawerRequest.id)
                    .map((a) => (
                      <div key={a.id}>
                        <i />
                        <b>{a.action}</b>
                        <small>
                          {person(a.actor)} · {timeLabel(a.at)}
                        </small>
                      </div>
                    ))}
                </div>
              </>
            )}
            {drawerProduct && (
              <>
                <div className="drawer-heading">
                  <small>
                    {drawerProduct.sku} · {drawerProduct.category}
                  </small>
                  <h2>{drawerProduct.name}</h2>
                  <div className="inventory-project">
                    <small>프로젝트</small>
                    <h3>{drawerProduct.project}</h3>
                  </div>
                </div>
                <div className="inventory-balance">
                  <span>현재 재고</span>
                  <strong>
                    {inventoryStock(state, drawerProduct.sku) === null
                      ? '-'
                      : number(inventoryStock(state, drawerProduct.sku)!)}
                    <small>개</small>
                  </strong>
                  <div className="inventory-warehouse">
                    <small>보관 물류창고</small>
                    <h3>{drawerProduct.center}</h3>
                  </div>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>바코드</dt>
                    <dd>{drawerProduct.barcode || '-'}</dd>
                  </div>
                  <div>
                    <dt>상품 속성</dt>
                    <dd>{drawerProduct.category}</dd>
                  </div>
                  <div>
                    <dt>박스당 수량</dt>
                    <dd>
                      {drawerProduct.isGift
                        ? '증정품 환산값 1'
                        : drawerProduct.capacity
                          ? drawerProduct.capacity + '개'
                          : '미등록'}
                    </dd>
                  </div>
                  <div>
                    <dt>비용 예측용 청구무게</dt>
                    <dd>
                      {drawerProduct.chargeWeight
                        ? number(drawerProduct.chargeWeight) + 'g'
                        : '미등록'}
                    </dd>
                  </div>
                </dl>
                {staff && (
                  <button
                    className="secondary full"
                    onClick={() =>
                      setModal({
                        type: 'inventory',
                        form: {
                          sku: drawerProduct.sku,
                          name: drawerProduct.name,
                          barcode: drawerProduct.barcode || '',
                          category: drawerProduct.category,
                          center: drawerProduct.center,
                          qty: inventoryStock(state, drawerProduct.sku) ?? '',
                          reason: '',
                        },
                      })
                    }
                  >
                    <Settings2 size={16} />
                    인벤토리 정보 수정
                  </button>
                )}
                {admin && (
                  <button
                    className="secondary full"
                    onClick={() =>
                      setModal({ type: 'product', form: { ...drawerProduct, reason: '' } })
                    }
                  >
                    <Settings2 size={16} />
                    상품·포장 기준 수정
                  </button>
                )}
                <h3 className="section-label">상품 변경 히스토리</h3>
                <div className="mini-timeline">
                  {state.audits
                    .filter((a) => a.target === drawerProduct.sku)
                    .map((a) => (
                      <div key={a.id}>
                        <i />
                        <b>{a.action}</b>
                        <small>
                          {person(a.actor)} · {timeLabel(a.at)}
                        </small>
                        <details>
                          <summary>변경 전후 보기</summary>
                          <p className="preserve">{a.before}</p>
                          <p className="preserve">{a.after}</p>
                        </details>
                      </div>
                    ))}
                </div>
                <h3 className="section-label">입출고 이력</h3>
                <div className="movement-list">
                  {state.movements
                    .filter((m) => m.sku === drawerProduct.sku)
                    .slice()
                    .reverse()
                    .map((m) => (
                      <div key={m.id}>
                        <span className={'round-icon ' + (m.qty >= 0 ? 'mint' : 'lilac')}>
                          {m.qty >= 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                        </span>
                        <div>
                          <b>
                            {m.type} · {m.project}
                          </b>
                          <p>{m.memo}</p>
                          <small>
                            {timeLabel(m.at)} · {person(m.actor)} · {m.requestId}
                          </small>
                        </div>
                        <strong className={m.qty >= 0 ? 'positive' : 'negative'}>
                          {m.qty >= 0 ? '+' : ''}
                          {number(m.qty)}
                        </strong>
                      </div>
                    ))}
                </div>
              </>
            )}
          </aside>
        </div>
      )}
      {modal && (
        <Modal
          guided={guideVisible && !guideWelcome}
          title={
            modal.title ||
            (
              {
                request: modal.edit ? '요청 정보 수정' : '입출고 요청',
                change: '수정 요청 보내기',
                review: '수정 요청 검토',
                complete: '실제 수량 확인·완료',
                notify: '물류팀에 요청하기',
                contract: '계약 기준 수정',
                tariff: '국가·무게 운임 등록',
                'stock-warning': '출고 요청 수량 확인',
                inventory: '인벤토리 정보 수정',
                product: '상품·포장 기준 수정',
                manage: '물류 정보 수정',
                notices: '알림 센터',
                issue: '물류 코드 발번',
                issued: '발번이 완료되었습니다!',
                copy: '발번 결과 복사',
                saved: '입력 정보 저장 완료',
                error: '확인이 필요합니다',
              } as any
            )[modal.type] ||
            '확인'
          }
          onClose={() =>
            !busy &&
            setModal(
              modal.type === 'stock-warning'
                ? modal.previous
                : modal.type === 'error' || modal.direct
                  ? modal.returnTo || null
                  : null,
            )
          }
          wide={['request', 'notices', 'issue', 'issued', 'copy'].includes(modal.type)}
        >
          {modal.type === 'stock-warning' && (
            <div className="modal-body">
              <span className="round-icon amber">
                <AlertTriangle size={25} />
              </span>
              <h3>출고 요청만큼 재고가 충분하지 않습니다. 그래도 요청하시겠습니까?</h3>
              <p className="preserve">{modal.message}</p>
              <p>
                입고 예정인 상품도 먼저 요청할 수 있습니다. 실제 출고 완료 시 재고를 다시
                확인합니다.
              </p>
              <div className="modal-actions">
                <button className="secondary" onClick={() => setModal(modal.previous)}>
                  취소
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    if (modal.next === 'direct') openDirect(true);
                    else await submitDraft(modal.form, true);
                  }}
                >
                  확인 후 계속
                </button>
              </div>
            </div>
          )}
          {modal.type === 'error' && (
            <div className="modal-body">
              <span className="round-icon error">
                <AlertTriangle size={24} />
              </span>
              <h3>입력 또는 처리 조건을 확인해 주세요.</h3>
              <p className="preserve">{modal.message}</p>
              <button className="primary full" onClick={() => setModal(modal.returnTo || null)}>
                확인
              </button>
            </div>
          )}
          {modal.type === 'confirm' && (
            <div className="modal-body">
              <span className="round-icon lilac">
                <CheckCircle2 size={24} />
              </span>
              <p className="preserve">{modal.message}</p>
              <div className="modal-actions">
                <button className="secondary" onClick={() => setModal(modal.returnTo || null)}>
                  취소
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    const go = modal.navigateProjects;
                    const result = await mutate(modal.action, modal.data, modal.success);
                    if (result && go) move('requests');
                    if (
                      result &&
                      modal.action === 'approve' &&
                      publicDemo &&
                      guideVisible &&
                      guideIndex === 3 &&
                      (guideKind === 'inbound' || guideKind === 'outbound') &&
                      result.requests.some(
                        (r) => r.id === modal.data.id && r.project === guideName && r.approved,
                      )
                    ) {
                      setGuideIndex(4);
                      move('calendar');
                    }
                  }}
                >
                  {busy ? '처리 중…' : modal.direct ? '확인' : '확인·진행'}
                </button>
              </div>
            </div>
          )}
          {modal.type === 'issue' && (
            <form
              className="modal-body issuance-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                issueCodes();
              }}
            >
              <div className="form-grid">
                <Field label="신청자">
                  <input
                    className="applicant-readonly"
                    value={actor!.name}
                    readOnly
                    aria-readonly="true"
                  />
                </Field>
                <Field label="소유권" required>
                  <select
                    value={modal.form.ownership}
                    onChange={(e) => formValue('ownership', e.target.value)}
                  >
                    <option>자사</option>
                    <option>타사</option>
                  </select>
                  <small className="field-hint">자사: 300000번대 · 타사: 500000번대</small>
                </Field>
                <Field label="프로젝트" required>
                  <input
                    placeholder="프로젝트 이름을 입력하세요"
                    value={modal.form.project}
                    onChange={(e) => formValue('project', e.target.value)}
                  />
                </Field>
              </div>
              <div className="issuance-caption">
                <h3>상품이름 · 상품속성</h3>
                <p>
                  상품이름과 분류가 입력된 행만 발번합니다. 상품이름은 [프로젝트이름]_상품이름으로
                  등록됩니다.
                </p>
              </div>
              <div className="issuance-table table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>
                        상품이름 <em>*</em>
                      </th>
                      <th>바코드</th>
                      <th>
                        상품 분류 <em>*</em>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {modal.form.items.map((r: any, i: number) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>
                          <input
                            aria-label={`상품이름 ${i + 1}`}
                            placeholder="상품이름"
                            value={r.name}
                            maxLength={150}
                            onChange={(e) => issueCell(i, 'name', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`바코드 ${i + 1}`}
                            placeholder="선택 입력"
                            value={r.barcode}
                            maxLength={80}
                            onChange={(e) => issueCell(i, 'barcode', e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            aria-label={`상품 분류 ${i + 1}`}
                            value={r.category}
                            onChange={(e) => issueCell(i, 'category', e.target.value)}
                          >
                            <option value="">분류 선택</option>
                            {productCategories.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="secondary full add-product-row"
                disabled={modal.form.items.length >= 50}
                onClick={() =>
                  formValue('items', [...modal.form.items, { name: '', barcode: '', category: '' }])
                }
              >
                <Plus size={16} />
                상품 행 추가
              </button>
              <p className="album-code-note">* 앨범 발번같은 경우 따로 요청해주세요.</p>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setModal(null)}>
                  취소
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? <LoaderCircle size={16} className="spin" /> : <Hash size={16} />}발번
                </button>
              </div>
            </form>
          )}
          {modal.type === 'issued' && (
            <div className="modal-body">
              <div className="issuance-success">
                <span className="round-icon mint">
                  <CheckCircle2 size={28} />
                </span>
                <h3>{modal.products.length}개 상품을 등록했어요</h3>
                <p>
                  입출고 요청을 원하실 경우, 복사버튼을 눌러 해당 시트의 첫행에 붙여넣기 해주세요!
                </p>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>상품이름</th>
                      <th>품번</th>
                      <th>프로젝트</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modal.products.map((p: Product) => (
                      <tr key={p.sku}>
                        <td>{p.name}</td>
                        <td>
                          <b className="sku-value">{p.sku}</b>
                        </td>
                        <td>{p.project}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="soft-info">
                <CheckCircle2 size={17} />
                <span>인벤토리에 등록했습니다. 초기 재고는 - 개 · 입고전입니다.</span>
              </div>
              <div className="modal-actions">
                <button
                  className="secondary"
                  onClick={() => {
                    setModal(null);
                    move('inventory');
                  }}
                >
                  인벤토리 보기
                </button>
                <button className="primary" onClick={() => copyCodes(modal.products)}>
                  <Copy size={16} />
                  복사
                </button>
              </div>
            </div>
          )}
          {modal.type === 'copy' && (
            <div className="modal-body">
              <p className="copy-instructions">
                클립보드 접근이 제한되었습니다. 아래 내용을 전체 선택해 복사한 뒤 시트 첫행에
                붙여넣어 주세요.
              </p>
              <textarea
                className="copy-text"
                rows={8}
                readOnly
                value={modal.text}
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="modal-actions">
                <button
                  className="secondary"
                  onClick={() => setModal({ type: 'issued', products: modal.products })}
                >
                  발번 결과로 돌아가기
                </button>
              </div>
            </div>
          )}
          {modal.type === 'request' && (
            <RequestForm
              form={modal.form}
              products={state.products}
              onDirect={() => checkOutbound('direct')}
              person={modal.form.owner ? person(modal.form.owner) : actor!.name}
              onChange={formValue}
              onSave={() => checkOutbound('save')}
              onCancel={() => setModal(null)}
              busy={busy}
              editing={modal.edit}
              allowZero={staff && !!modal.edit}
            />
          )}
          {modal.type === 'saved' && (
            <div className="modal-body">
              <span className="round-icon mint">
                <CheckCircle2 size={28} />
              </span>
              <h3>저장되었습니다.</h3>
              <p className="preserve">{`저장되었습니다. 정보를 다시 한 번 확인하고, 하단 ‘요청’ 버튼을 눌러주세요. ${modal.request.type} 요청이 진행된 경우, 정보는 논의 후 수정 가능합니다.`}</p>
              <div className="soft-info">
                <Info size={17} />
                <span>현재 상태: 입력완료 · 물류팀 요청 전</span>
              </div>
              <button className="primary full" onClick={() => setModal(null)}>
                정보 확인하기
              </button>
            </div>
          )}
          {modal.type === 'change' && (
            <form
              className="modal-body"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                mutate(
                  'change',
                  modal.form,
                  '수정 요청을 보냈습니다. 담당자의 승인을 기다려 주세요.',
                );
              }}
            >
              <div className="soft-info">
                <FileClock size={18} />
                <span>담당자가 승인할 때 원본 요청과 일정이 함께 변경됩니다.</span>
              </div>
              <div className="form-grid">
                {(modal.form.items || []).map((x: any, i: number) => (
                  <Field key={x.sku} label={`${product(x.sku)?.name || x.sku} 변경 수량`} required>
                    <input
                      type="number"
                      min="1"
                      value={x.qty}
                      onChange={(e) => {
                        const items = modal.form.items.map((v: any, n: number) =>
                          n === i ? { ...v, qty: Number(e.target.value) } : v,
                        );
                        formValue('items', items);
                        formValue(
                          'qty',
                          items.reduce((n: number, v: any) => n + v.qty, 0),
                        );
                      }}
                    />
                  </Field>
                ))}
                <Field label="변경 일정" required>
                  <input
                    type="date"
                    value={modal.form.date}
                    onChange={(e) => formValue('date', e.target.value)}
                  />
                </Field>
              </div>
              <Field
                label="수정 사유 (변경사항이 다른 영역일 경우, 수정 사유에 따로 적어주세요)"
                required
              >
                <textarea
                  rows={3}
                  value={modal.form.reason}
                  onChange={(e) => formValue('reason', e.target.value)}
                />
              </Field>
              <div className="modal-actions">
                <button className="primary" disabled={busy}>
                  수정 요청 보내기
                </button>
              </div>
            </form>
          )}
          {modal.type === 'review' &&
            (() => {
              const c = state.changes.find((c) => c.id === modal.id);
              const r = state.requests.find((r) => r.id === c?.requestId);
              if (!c || !r) return <Empty />;
              return (
                <div className="modal-body">
                  <h3>{r.project}</h3>
                  <div className="review-diff">
                    <div>
                      <small>현재 요청</small>
                      <b>{number(r.qty)}개</b>
                      <p>{r.date}</p>
                    </div>
                    <ArrowRight size={22} />
                    <div>
                      <small>변경 요청</small>
                      <b>{number(c.qty)}개</b>
                      <p>{c.date}</p>
                    </div>
                  </div>
                  <div className="detail-note">
                    <h3>변경 사유</h3>
                    <p>{c.reason}</p>
                  </div>
                  <p className="muted small">
                    요청자 {person(c.owner)} · {timeLabel(c.createdAt)}
                  </p>
                  {staff && (
                    <div className="modal-actions">
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          mutate(
                            'review-change',
                            { id: c.id, approve: false },
                            '수정 요청을 반려했습니다.',
                          )
                        }
                      >
                        반려
                      </button>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          mutate(
                            'review-change',
                            { id: c.id, approve: true },
                            '수정 요청을 승인했습니다. 캘린더도 함께 변경되었습니다.',
                          )
                        }
                      >
                        <Check size={16} />
                        변경 승인
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          {modal.type === 'complete' && (
            <form
              className="modal-body"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                mutate('status', modal.form, '입출고를 완료하고 재고·히스토리에 반영했습니다.');
              }}
            >
              <div className="warning-box">
                <AlertTriangle size={18} />
                <span>
                  실제 확인한 수량만 입력해 주세요. 완료 후 재고에 한 번 반영되며 직접 변경할 수
                  없습니다.
                </span>
              </div>
              {modal.form.actuals.map((x: any, i: number) => (
                <Field key={x.sku} label={`${x.sku} · ${product(x.sku)?.name} 실수량`} required>
                  <input
                    type="number"
                    min="0"
                    value={x.actual}
                    onChange={(e) =>
                      formValue(
                        'actuals',
                        modal.form.actuals.map((v: any, n: number) =>
                          n === i ? { ...v, actual: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </Field>
              ))}
              <Field label="확인 메모">
                <textarea
                  rows={3}
                  value={modal.form.memo}
                  onChange={(e) => formValue('memo', e.target.value)}
                />
              </Field>
              <div className="modal-actions">
                <button className="primary" disabled={busy}>
                  <CheckCheck size={17} />
                  실수량 확인·완료
                </button>
              </div>
            </form>
          )}
          {modal.type === 'manage' && (
            <form
              className="modal-body"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                mutate(
                  'manage-project',
                  {
                    ...modal.form,
                    expectedCompletion: String(
                      new FormData(e.currentTarget).get('expectedCompletion') || '',
                    ),
                  },
                  '물류 정보를 수정하고 전사 일정에 반영했습니다.',
                );
              }}
            >
              <Field label="물류 담당자">
                <select
                  disabled={!admin}
                  value={modal.form.assignee}
                  onChange={(e) => formValue('assignee', e.target.value)}
                >
                  {state.actors
                    .filter((a) => a.role !== 'requester')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {roleLabel[a.role]}
                      </option>
                    ))}
                </select>
                <small className="field-hint">담당자는 물류 어드민이 변경합니다.</small>
              </Field>
              <Field label="물류사">
                <select
                  value={modal.form.center}
                  onChange={(e) => formValue('center', e.target.value)}
                >
                  <option value="">상품의 보관 센터 기준</option>
                  <option>다보내</option>
                  <option>패박</option>
                  <option>미배정</option>
                </select>
              </Field>
              <Field label={`${modal.requestType} 완료예상 시점`}>
                <input
                  type="date"
                  name="expectedCompletion"
                  value={modal.form.expectedCompletion}
                  onChange={(e) => formValue('expectedCompletion', e.target.value)}
                />
                <small className="field-hint">
                  요청일과 다르면 프로젝트 메모에 이유를 남겨주세요.
                </small>
              </Field>
              <div className="modal-actions">
                <button className="primary" disabled={busy}>
                  정보 저장
                </button>
              </div>
            </form>
          )}
          {modal.type === 'notify' && (
            <form
              className="modal-body"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                mutate('notify', modal.form, '담당자 통지를 앱 내 알림과 대기함에 기록했습니다.');
              }}
            >
              <Field label="물류팀에 전달할 내용" required>
                <textarea
                  rows={5}
                  placeholder="요청사항이나 문의 내용을 입력하세요."
                  value={modal.form.message}
                  onChange={(e) => formValue('message', e.target.value)}
                />
              </Field>
              <div className="soft-info">
                <MessageSquare size={17} />
                <span>
                  앱 내 알림으로 기록됩니다. Slack 미연결 상태로 실제 외부 메시지는 전송되지
                  않습니다.
                </span>
              </div>
              <div className="modal-actions">
                <button className="primary" disabled={busy}>
                  <Send size={16} />
                  담당자에게 통지
                </button>
              </div>
            </form>
          )}
          {modal.type === 'contract' && (
            <form
              className="modal-body"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                mutate(
                  'contract',
                  modal.form,
                  '계약 기준을 변경하고 이전 값을 이력에 보존했습니다.',
                );
              }}
            >
              <h3>
                {modal.form.name} · v{modal.form.version}
              </h3>
              <div className="form-grid">
                {[
                  ['base', '국내 기본 배송비'],
                  ['labor', '국내 기본 작업료'],
                  ['overseasLabor', '해외 기본 작업료'],
                  ['material', '부자재 비용'],
                  ['free', '무료 처리 수량'],
                  ['extra', '추가 작업료 / 개'],
                  ['cap', '추가 작업료 상한 · 0=무제한'],
                ].map(([k, l]) => (
                  <Field key={k} label={l} required>
                    <input
                      type="number"
                      min="0"
                      value={modal.form[k]}
                      onChange={(e) => formValue(k, e.target.value)}
                    />
                  </Field>
                ))}
              </div>
              <Field label="변경 사유" required>
                <textarea
                  rows={2}
                  value={modal.form.reason}
                  onChange={(e) => formValue('reason', e.target.value)}
                />
              </Field>
              <div className="modal-actions">
                <button className="primary" disabled={busy}>
                  기준 변경·이력 저장
                </button>
              </div>
            </form>
          )}
          {modal.type === 'tariff' && (
            <form
              className="modal-body"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                mutate('tariff', modal.form, '국가·무게 운임을 저장했습니다.');
              }}
            >
              <div className="form-grid">
                {[
                  ['country', '국가코드 · 예: JP'],
                  ['weight', '청구무게 g'],
                  ['a', '다보내 운임 원'],
                  ['b', '패스트박스 운임 원'],
                ].map(([k, l]) => (
                  <Field key={k} label={l} required>
                    <input
                      type={k === 'country' ? 'text' : 'number'}
                      value={modal.form[k]}
                      onChange={(e) => formValue(k, e.target.value)}
                    />
                  </Field>
                ))}
              </div>
              <Field label="변경 사유" required>
                <textarea
                  value={modal.form.reason}
                  onChange={(e) => formValue('reason', e.target.value)}
                />
              </Field>
              <div className="modal-actions">
                <button className="primary" disabled={busy}>
                  운임 저장
                </button>
              </div>
            </form>
          )}
          {modal.type === 'inventory' && (
            <form
              className="modal-body"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                mutate(
                  'inventory',
                  modal.form,
                  '인벤토리를 수정하고 변경 전후를 히스토리에 남겼습니다.',
                );
              }}
            >
              <h3>{modal.form.name}</h3>
              <Field label="바코드">
                <input
                  value={modal.form.barcode}
                  maxLength={80}
                  onChange={(e) => formValue('barcode', e.target.value)}
                />
              </Field>
              <Field label="상품 속성" required>
                <select
                  value={modal.form.category}
                  onChange={(e) => formValue('category', e.target.value)}
                >
                  {[
                    ...new Set([...productCategories, ...state.products.map((p) => p.category)]),
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="보관 물류창고" required>
                <input
                  value={modal.form.center}
                  onChange={(e) => formValue('center', e.target.value)}
                  list="warehouse-options"
                />
                <datalist id="warehouse-options">
                  <option value="다보내 · 이천" />
                  <option value="패스트박스 · 김포" />
                  <option value="미배정" />
                </datalist>
              </Field>
              <Field label="현재 재고">
                <input
                  type="number"
                  min="0"
                  placeholder="미확인 재고는 빈칸 유지"
                  value={modal.form.qty}
                  onChange={(e) => formValue('qty', e.target.value)}
                />
              </Field>
              <Field label="변경 사유" required>
                <textarea
                  rows={3}
                  value={modal.form.reason}
                  onChange={(e) => formValue('reason', e.target.value)}
                />
              </Field>
              <div className="soft-info">
                <History size={18} />
                <span>
                  바코드·속성·창고·재고의 변경 전후와 담당자·시각·사유를 기록합니다. 재고 차이는
                  조정 원장에 반영합니다.
                </span>
              </div>
              <div className="modal-actions">
                <button className="primary" disabled={busy}>
                  저장 · 히스토리 기록
                </button>
              </div>
            </form>
          )}
          {modal.type === 'product' && (
            <form
              className="modal-body"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                mutate('product', modal.form, '상품·포장 기준을 변경했습니다.');
              }}
            >
              <h3>{modal.form.name}</h3>
              <Field label="한 박스에 몇 개가 들어가나요?" required>
                <input
                  type="number"
                  min="1"
                  max="15000"
                  value={modal.form.capacity}
                  onChange={(e) => formValue('capacity', e.target.value)}
                />
              </Field>
              <Field label="비용 예측용 MD청구무게 g" required>
                <input
                  type="number"
                  min="1"
                  value={modal.form.chargeWeight}
                  onChange={(e) => formValue('chargeWeight', e.target.value)}
                />
              </Field>
              <Field label="변경 사유" required>
                <textarea
                  value={modal.form.reason}
                  onChange={(e) => formValue('reason', e.target.value)}
                />
              </Field>
              <div className="modal-actions">
                <button className="primary" disabled={busy}>
                  기준 저장·이력 기록
                </button>
              </div>
            </form>
          )}
          {modal.type === 'notices' && (
            <div className="modal-body">
              <div className="soft-info">
                <Bell size={17} />
                <span>
                  앱 내 알림이 저장됩니다. Slack 연결 전에는 외부 전송 없이 대기 상태를 유지합니다.
                </span>
              </div>
              <div className="notification-list">
                {state.notices.map((n) => (
                  <div key={n.id}>
                    <span className="round-icon lilac">
                      <Bell size={17} />
                    </span>
                    <div>
                      <b>{n.title}</b>
                      <p>{n.message}</p>
                      <small>
                        {timeLabel(n.at)} · {n.status}
                        {n.attempts > 0 && ` · 재처리 ${n.attempts}회`}
                      </small>
                      {(() => {
                        const r = state.requests.find(
                          (r) => r.status !== '입력완료' && n.message.includes(r.project),
                        );
                        return r ? (
                          <button
                            className="small-button notification-request-open"
                            aria-label={`${r.project} 요청 확인`}
                            onClick={() => {
                              setModal(null);
                              move('requests');
                              setMineOnly(false);
                              openRequestDetail(r.id);
                            }}
                          >
                            요청 확인 <ChevronRight size={14} />
                          </button>
                        ) : null;
                      })()}
                    </div>
                    {staff && (
                      <button
                        className="icon-btn"
                        aria-label="알림 재처리"
                        onClick={() =>
                          setModal({
                            type: 'confirm',
                            title: '알림을 재처리할까요?',
                            message:
                              'Slack 연결 상태를 다시 확인하고 시도 이력을 기록합니다. 연결 전에는 실제 전송하지 않습니다.',
                            action: 'retry-notice',
                            data: { id: n.id },
                            success:
                              '연결 미설정으로 대기 상태를 유지하고 시도 이력을 기록했습니다.',
                          })
                        }
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
      {publicDemo && guideVisible && (
        <DemoGuide
          welcome={guideWelcome}
          kind={guideKind}
          index={guideIndex}
          step={guideStepForView()}
          done={guideDone()}
          busy={busy}
          onStart={() => chooseGuide('inbound')}
          onSkip={() => {
            setGuideWelcome(false);
            setGuideVisible(false);
          }}
          onChoose={chooseGuide}
          onOpen={() => guideKind && openGuideStep(guideKind, guideIndex)}
          onBack={async () => {
            if (!guideKind) return;
            const i = Math.max(0, guideIndex - 1);
            setGuideIndex(i);
            await openGuideStep(guideKind, i);
          }}
          onNext={async () => {
            if (!guideKind) return;
            if (guideIndex === guideSteps(guideKind).length - 1) {
              setGuideKind(null);
              setModal(null);
              setDrawer(null);
              return;
            }
            const i = guideIndex + 1;
            setGuideIndex(i);
            await openGuideStep(guideKind, i);
          }}
          onMenu={() => {
            setGuideKind(null);
            setModal(null);
            setDrawer(null);
          }}
          onClose={() => {
            setGuideVisible(false);
            setGuideWelcome(false);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {busy && (
        <div className="saving-indicator">
          <LoaderCircle size={14} className="spin" />
          저장 중
        </div>
      )}
    </div>
  );
}
