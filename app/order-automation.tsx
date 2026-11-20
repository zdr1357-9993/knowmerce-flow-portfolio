'use client';
import { useState } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  Package,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Truck,
  SlidersHorizontal,
  ClipboardCheck,
  ChevronRight,
  LoaderCircle,
} from 'lucide-react';
import { State, Job } from '../lib/model';
import {
  parseOrderCSV,
  csvText,
  outputRows,
  mdExample,
  albumExample,
  albumWinnerExample,
  csvTable,
  OrderRow,
} from '../lib/order-files';
import { makeXlsx } from '../lib/xlsx';
const num = (n: number) => Number(n || 0).toLocaleString('ko-KR');
function download(rows: any[], name: string) {
  const url = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]/g, '_');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadWorkbook(sheets: { name: string; rows: Record<string, any>[] }[], name: string) {
  const bytes = makeXlsx(sheets);
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]/g, '_');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
type Props = {
  state: State;
  busy: boolean;
  onSave: (action: string, data: any, message: string) => Promise<State | false | undefined>;
};
export default function OrderAutomation({ state, busy, onSave }: Props) {
  const [mode, setMode] = useState<'md' | 'album'>('md'),
    [project, setProject] = useState(''),
    [rows, setRows] = useState<OrderRow[]>([]),
    [settings, setSettings] = useState<Record<string, any>>({}),
    [file, setFile] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [active, setActive] = useState(''),
    [tab, setTab] = useState('전체'),
    [boxLimit, setBoxLimit] = useState(20),
    [target, setTarget] = useState(''),
    [variants, setVariants] = useState<string[]>([]),
    [winners, setWinners] = useState<any[]>([]),
    [winnerFile, setWinnerFile] = useState(''),
    [winnerAddition, setWinnerAddition] = useState<any>({
      enabled: false,
      options: ['팬싸인회'],
      sku: '300099',
      name: 'ATEEZ 당첨자 추가 앨범',
      unitQty: 1,
      unitPrice: 1,
      chargeWeight: 550,
    });
  const current = state.jobs.find((j) => j.id === active),
    result = current?.result;
  const skus = [
    ...new Set(
      rows.filter((r) => r.shippingStatus.toLowerCase() !== 'cancelled').map((r) => r.sku),
    ),
  ];
  const inputQty = rows.reduce((n, r) => n + r.qty, 0),
    orderCount = new Set(rows.map((r) => r.order)).size;
  const albums = state.products.filter((p) => p.category === '앨범');
  function loadRows(data: OrderRow[], name: string, demo = false) {
    const config: Record<string, any> = {};
    for (const r of data) {
      if (config[r.sku]) continue;
      const p = state.products.find((p) => p.sku === r.sku);
      config[r.sku] = {
        name: p?.name || r.name || r.sku,
        capacity: p?.capacity || '',
        chargeWeight: p?.chargeWeight || '',
        isGift: !!p?.isGift,
      };
      if (demo && r.sku === '500101')
        Object.assign(config[r.sku], { capacity: 10, chargeWeight: 300 });
      if (demo && r.sku === '500102')
        Object.assign(config[r.sku], { capacity: 15, chargeWeight: 200 });
    }
    setRows(data);
    setSettings(config);
    setFile(name);
    setProject(name.replace(/\.[^.]+$/, ''));
    setActive('');
    setError('');
    setWinners([]);
    setWinnerFile('');
    const first = data.find((r) => albums.some((p) => p.sku === r.sku));
    setTarget(first?.sku || '');
    const p = albums.find((p) => p.sku === first?.sku);
    setVariants(albums.filter((a) => a.project === p?.project).map((a) => a.sku));
  }
  async function upload(f: File) {
    setLoading(true);
    setError('');
    try {
      if (!f.name.toLowerCase().endsWith('.csv'))
        throw Error(
          '현재 업로드 입력은 CSV UTF-8 형식입니다. 결과는 국내·해외 XLSX로 각각 내려받을 수 있습니다.',
        );
      if (f.size > 1500000) throw Error('1.5MB 이하 CSV를 업로드해주세요.');
      const data = parseOrderCSV(await f.text());
      loadRows(data, f.name);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function uploadWinners(f: File) {
    try {
      if (f.size > 1500000) throw Error('당첨자 파일은 1.5MB 이하로 업로드해주세요.');
      const table = csvTable(await f.text()),
        heads = table.shift() || [];
      const i = heads.findIndex((h) =>
        ['merchant uid', 'merchant_uid', 'order', '주문번호'].includes(h.trim().toLowerCase()),
      );
      if (i < 0) throw Error('당첨자 CSV에는 merchant_uid 또는 주문번호 열이 필요합니다.');
      const o = heads.findIndex((h) =>
        ['option', '옵션', '당첨구분'].includes(h.trim().toLowerCase()),
      );
      setWinners(
        table
          .filter((r) => r[i]?.trim())
          .map((r) => ({
            order: r[i].trim(),
            option: o >= 0 ? r[o]?.trim() || '당첨자' : '당첨자',
          })),
      );
      setWinnerFile(f.name);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  }
  function setValue(sku: string, key: string, value: any) {
    setSettings((s) => ({ ...s, [sku]: { ...s[sku], [key]: value } }));
  }
  async function run() {
    setError('');
    if (!project.trim()) {
      setError('가공 작업 이름을 입력해주세요.');
      return;
    }
    if (!rows.length) {
      setError('주문서를 먼저 업로드해주세요.');
      return;
    }
    if (mode === 'album' && !target) {
      setError('분할할 앨범 품번을 선택해주세요.');
      return;
    }
    for (const sku of skus) {
      const p = settings[sku];
      if (
        !p.name ||
        !Number.isInteger(Number(p.capacity)) ||
        Number(p.capacity) < 1 ||
        !Number.isInteger(Number(p.chargeWeight)) ||
        Number(p.chargeWeight) < 1
      ) {
        setError(p.name + ' · 박스당 수량과 1개당 예측 청구무게를 입력해주세요.');
        return;
      }
    }
    const saved = await onSave(
      'automation',
      {
        mode,
        project,
        rows,
        productSettings: settings,
        boxLimit,
        targetSku: target,
        variants,
        winners,
        winnerAddition,
        fileName: file,
      },
      '가공·예측을 완료했습니다. 수량과 비용을 검수해주세요.',
    );
    if (saved) {
      setActive(saved.jobs[0].id);
      setTab('전체');
    }
  }
  async function reprocess(job: Job) {
    const saved = await onSave(
      'reprocess',
      { id: job.id },
      '새 개정으로 재처리했습니다. 이전 결과는 유지됩니다.',
    );
    if (saved) setActive(saved.jobs[0].id);
  }
  const shown =
    result?.rows.filter(
      (r: any) => tab === '전체' || (tab === '국내' ? r.country === 'KR' : r.country !== 'KR'),
    ) || [];
  const boxRows =
    result?.boxes.map((b: any) => ({
      박스번호: b.order,
      원주문번호: b.original || '',
      국가코드: b.country,
      상품수량: b.qty,
      예측청구무게_g: b.weight,
      운임적용무게_g: b.billableWeight || Math.ceil(b.weight / 500) * 500,
      다보내배송비: b.breakdown?.a?.freight ?? '',
      다보내작업료: b.breakdown?.a?.labor ?? '',
      다보내추가작업료: b.breakdown?.a?.additional ?? '',
      다보내부자재비: b.breakdown?.a?.material ?? '',
      다보내총액: b.a ?? '미산정',
      패박배송비: b.breakdown?.b?.freight ?? '',
      패박작업료: b.breakdown?.b?.labor ?? '',
      패박추가작업료: b.breakdown?.b?.additional ?? '',
      패박부자재비: b.breakdown?.b?.material ?? '',
      패박총액: b.b ?? '미산정',
    })) || [];
  function exportWorkbook(region: '국내' | '해외') {
    if (!result || !current) return;
    const inRegion = (r: any) => (region === '국내' ? r.country === 'KR' : r.country !== 'KR');
    const regionRows = result.rows.filter(inRegion),
      regionBoxes = result.boxes.filter(inRegion),
      rawRows = (current.input.rows || []).filter(inRegion);
    const countryByOrder = new Map<string, string>();
    for (const r of current.input.rows || []) countryByOrder.set(r.order, r.country);
    const deductions = (result.deductionRows || [])
      .filter((r: any) => inRegion({ country: countryByOrder.get(r.order) }))
      .map((r: any) => ({
        주문번호: r.order,
        앨범품번: r.sku,
        차감전수량: r.before,
        당첨수량: r.deducted,
        가공대상수량: r.after,
        당첨옵션: (current.input.winners || [])
          .filter((w: any) => w.order === r.order)
          .map((w: any) => w.option || '당첨자')
          .join(' · '),
      }));
    const additions = (result.winnerAdditionRows || [])
      .filter((r: any) => inRegion({ country: r.country }))
      .map((r: any) => ({
        원주문번호: r.order,
        박스번호: r.box,
        상품품번: r.sku,
        상품명: r.name,
        선택Option: r.options,
        당첨Option수: r.optionCount,
        추가수량: r.qty,
      }));
    const regionalInventory = (result.inventory || [])
      .map((p: any) => ({
        이름: p.name,
        갯수: regionRows
          .filter((r: any) => r.sku === p.sku)
          .reduce((n: number, r: any) => n + r.qty, 0),
        품번: p.sku,
      }))
      .filter((r: any) => r.갯수 > 0);
    const costs = regionBoxes.flatMap((b: any) => [
      {
        박스번호: b.order,
        국가: b.country,
        물류사: '다보내',
        예상금액: b.a ?? '미산정',
        운임: b.breakdown?.a?.freight ?? '미산정',
        작업료: b.breakdown?.a?.labor ?? '미산정',
        부자재비: b.breakdown?.a?.material ?? '미산정',
        추가작업료: b.breakdown?.a?.additional ?? '미산정',
        운임적용무게_g: b.billableWeight,
      },
      {
        박스번호: b.order,
        국가: b.country,
        물류사: '패스트박스',
        예상금액: b.b ?? '미산정',
        운임: b.breakdown?.b?.freight ?? '미산정',
        작업료: b.breakdown?.b?.labor ?? '미산정',
        부자재비: b.breakdown?.b?.material ?? '미산정',
        추가작업료: b.breakdown?.b?.additional ?? '미산정',
        운임적용무게_g: b.billableWeight,
      },
    ]);
    const orderCosts = [...new Set(regionBoxes.map((b: any) => b.original || b.order))].map(
      (order) => {
        const boxes = regionBoxes.filter((b: any) => (b.original || b.order) === order);
        return {
          주문번호: order,
          국가코드: boxes[0]?.country,
          박스수: boxes.length,
          상품수량: boxes.reduce((n: number, b: any) => n + b.qty, 0),
          예측상품무게_g: boxes.reduce((n: number, b: any) => n + b.weight, 0),
          운임적용무게_g: boxes.reduce((n: number, b: any) => n + b.billableWeight, 0),
          다보내총배송비: boxes.some((b: any) => b.a === null)
            ? '미산정'
            : boxes.reduce((n: number, b: any) => n + b.a, 0),
          패박총배송비: boxes.some((b: any) => b.b === null)
            ? '미산정'
            : boxes.reduce((n: number, b: any) => n + b.b, 0),
        };
      },
    );
    const issues = (result.issues || [])
      .filter((v: any) =>
        inRegion((current.input.rows || []).find((r: any) => r.sourceRow === v.row) || {}),
      )
      .map((v: any) => ({ 원본행: v.row, 주문번호: v.order, 확인내용: v.message }));
    const warnings = (result.warnings || []).map((v: string) => ({
      원본행: '',
      주문번호: '',
      확인내용: v,
    }));
    downloadWorkbook(
      [
        { name: '원본', rows: outputRows(rawRows) },
        { name: region, rows: outputRows(regionRows) },
        { name: region + '_가격', rows: orderCosts },
        { name: '재고_값', rows: regionalInventory },
        {
          name: '당첨자빼기진행_주문서',
          rows: outputRows(regionRows.filter((r: any) => !r.winnerAddition)),
        },
        { name: '당첨자차감', rows: deductions },
        { name: '당첨자추가', rows: additions },
        { name: '박스별예상비용', rows: costs },
        { name: '확인필요', rows: [...issues, ...warnings] },
      ],
      `${current.project}_${region}.xlsx`,
    );
  }
  return (
    <div className="order-automation">
      <div className="workflow-stepper">
        <div className="active">
          <b>1</b>주문서 업로드
        </div>
        <i />
        <div className={rows.length ? 'active' : ''}>
          <b>2</b>포장·무게 설정
        </div>
        <i />
        <div className={result ? 'active' : ''}>
          <b>3</b>분할·비용 예측
        </div>
        <i />
        <div className={result ? 'active' : ''}>
          <b>4</b>검수·다운로드
        </div>
      </div>
      <div className="automation-layout md-automation-layout">
        <div>
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>주문서 준비</h2>
                <p>원본 정보를 보존하고 주문별 박스로 나눕니다.</p>
              </div>
              <span className="round-icon lilac">
                <FileSpreadsheet />
              </span>
            </div>
            <div className="form-body">
              <div className="segmented">
                {[
                  ['md', 'MD 가공·예측'],
                  ['album', '앨범 가공·예측'],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    className={mode === v ? 'active' : ''}
                    onClick={() => {
                      setMode(v as any);
                      setError('');
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <label className="field">
                <span>
                  가공 작업 이름 <em>*</em>
                </span>
                <input
                  value={project}
                  maxLength={120}
                  placeholder="예: FLOWER TOUR MD 2차"
                  onChange={(e) => setProject(e.target.value)}
                />
              </label>
              <label className="upload-zone md-upload">
                <Upload size={28} />
                <b>{loading ? '주문서를 읽고 있어요' : 'fromm 주문서 CSV 업로드'}</b>
                <span>주문번호 · 재고코드 · 수량 · 국가코드 필수</span>
                <small>
                  수령인·연락처·주소 등 나머지 열도 보존합니다. 결과는 국내·해외 XLSX로 나뉩니다.
                </small>
                <input
                  aria-label="주문서 업로드"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={loading || busy}
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
                <span className="secondary">파일 선택</span>
              </label>
              <div className="md-example-actions">
                <button
                  className="primary"
                  onClick={() => {
                    setMode('md');
                    loadRows(mdExample(), 'FLOWER TOUR MD 예시.csv', true);
                  }}
                >
                  <Package size={16} />
                  MD 예시로 체험
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    setMode('album');
                    loadRows(albumExample(), 'ATEEZ 앨범 자동화 예시.csv', true);
                    setWinners(albumWinnerExample());
                    setWinnerAddition((v: any) => ({ ...v, enabled: true }));
                    setWinnerFile('앨범 당첨자 예시 · 당첨자 1건 + 팬싸인회 1건 + 당첨자 1건');
                  }}
                >
                  <Package size={16} />
                  앨범 예시로 체험
                </button>
                <button
                  className="text-btn"
                  onClick={() => download(outputRows(mdExample()), 'MD_업로드_예시.csv')}
                >
                  <Download size={15} />
                  MD CSV 예시 받기
                </button>
                <button
                  className="text-btn"
                  onClick={() => download(outputRows(albumExample()), '앨범_업로드_예시.csv')}
                >
                  <Download size={15} />
                  앨범 CSV 예시 받기
                </button>
              </div>
              {file && (
                <div className="md-file-summary">
                  <FileSpreadsheet size={22} />
                  <div>
                    <b>{file}</b>
                    <p>
                      {num(rows.length)}행 · {num(orderCount)}주문 · {num(inputQty)}개
                    </p>
                  </div>
                  <CheckCircle2 size={19} />
                </div>
              )}
              {error && (
                <div className="warning-box" role="alert">
                  <AlertTriangle size={18} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </section>
          {rows.length > 0 && (
            <section className="panel md-settings">
              <div className="panel-header">
                <div>
                  <h2>상품별 포장·청구무게</h2>
                  <p>박스 용량과 비용 예측용 무게를 각각 설정해주세요.</p>
                </div>
                <SlidersHorizontal size={22} />
              </div>
              <div className="form-body">
                <div className="soft-info">
                  <Package size={19} />
                  <span>
                    ‘한 박스에 몇 개?’는 포장 용량입니다. ‘청구무게’는 비용 예측에 사용하는{' '}
                    <b>상품 1개당 보정값(g)</b>입니다. 이번 가공의 입력값은 인벤토리를 바꾸지
                    않습니다.
                  </span>
                </div>
                <div className="md-product-settings">
                  {skus.map((sku) => {
                    const p = settings[sku],
                      registered = state.products.some((p) => p.sku === sku);
                    return (
                      <article key={sku}>
                        <header>
                          <div>
                            <b>{p?.name}</b>
                            <small>
                              {sku} · {registered ? '인벤토리 등록 상품' : '이번 가공용 상품'}
                            </small>
                          </div>
                          <span className="status purple">
                            {num(rows.filter((r) => r.sku === sku).reduce((n, r) => n + r.qty, 0))}
                            개
                          </span>
                        </header>
                        <div className="form-grid">
                          <label className="field">
                            <span>한 박스에 몇 개?</span>
                            <div className="input-unit">
                              <input
                                aria-label={sku + ' 박스당 수량'}
                                type="number"
                                min="1"
                                max="15000"
                                step="1"
                                disabled={p?.isGift}
                                value={p?.capacity ?? ''}
                                onChange={(e) => setValue(sku, 'capacity', e.target.value)}
                              />
                              <span>개</span>
                            </div>
                          </label>
                          <label className="field">
                            <span>1개당 예측 청구무게</span>
                            <div className="input-unit">
                              <input
                                aria-label={sku + ' 청구무게'}
                                type="number"
                                min="1"
                                max="1000000"
                                step="1"
                                value={p?.chargeWeight ?? ''}
                                onChange={(e) => setValue(sku, 'chargeWeight', e.target.value)}
                              />
                              <span>g</span>
                            </div>
                          </label>
                        </div>
                        {p?.isGift && (
                          <small className="field-hint">
                            증정품은 기존 기준대로 박스 용량 환산값 1을 사용합니다.
                          </small>
                        )}
                      </article>
                    );
                  })}
                </div>
                {mode === 'album' && (
                  <div className="md-album-settings">
                    <label className="field">
                      <span>분할·당첨자 차감 대상 앨범</span>
                      <select
                        value={target}
                        onChange={(e) => {
                          setTarget(e.target.value);
                          const p = albums.find((a) => a.sku === e.target.value);
                          setVariants(
                            albums.filter((a) => a.project === p?.project).map((a) => a.sku),
                          );
                        }}
                      >
                        <option value="">앨범 선택</option>
                        {skus
                          .filter((sku) => albums.some((p) => p.sku === sku))
                          .map((sku) => (
                            <option key={sku} value={sku}>
                              {state.products.find((p) => p.sku === sku)?.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <h3>분배할 앨범 버전</h3>
                    <div className="md-variant-choices">
                      {albums
                        .filter((p) => p.project === albums.find((a) => a.sku === target)?.project)
                        .map((p) => (
                          <label key={p.sku}>
                            <input
                              type="checkbox"
                              checked={variants.includes(p.sku)}
                              onChange={(e) =>
                                setVariants(
                                  e.target.checked
                                    ? [...variants, p.sku]
                                    : variants.filter((s) => s !== p.sku),
                                )
                              }
                            />
                            {p.name} · {p.sku}
                          </label>
                        ))}
                    </div>
                    <label className="field">
                      <span>한 박스의 최대 앨범 수량</span>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={boxLimit}
                        onChange={(e) => setBoxLimit(Number(e.target.value))}
                      />
                    </label>
                    <label className="field">
                      <span>당첨자 제외 CSV · 선택</span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => e.target.files?.[0] && uploadWinners(e.target.files[0])}
                      />
                      <small>
                        {winnerFile || '차감하지 않으면 업로드하지 않아도 됩니다.'} ·{' '}
                        {winners.length}회 차감{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setWinners([]);
                            setWinnerFile('');
                          }}
                        >
                          초기화
                        </button>
                      </small>
                    </label>
                    <div className="winner-add-card">
                      <label className="md-variant-choices">
                        <span>
                          <input
                            type="checkbox"
                            checked={!!winnerAddition.enabled}
                            onChange={(e) =>
                              setWinnerAddition((v: any) => ({ ...v, enabled: e.target.checked }))
                            }
                          />{' '}
                          당첨 Option 선택 후 별도 상품 행 추가
                        </span>
                      </label>
                      {winnerAddition.enabled && (
                        <>
                          <p className="field-hint">
                            선택한 Option 수만큼 지정 상품을 추가하고, 원주문의 마지막 박스에
                            연결합니다.
                          </p>
                          <label className="field">
                            <span>추가할 Option</span>
                            <div className="md-variant-choices">
                              {[...new Set(winners.map((w) => w.option || '당첨자'))].map(
                                (option: string) => (
                                  <label key={option}>
                                    <input
                                      type="checkbox"
                                      checked={winnerAddition.options.includes(option)}
                                      onChange={(e) =>
                                        setWinnerAddition((v: any) => ({
                                          ...v,
                                          options: e.target.checked
                                            ? [...v.options, option]
                                            : v.options.filter((x: string) => x !== option),
                                        }))
                                      }
                                    />
                                    {option}
                                  </label>
                                ),
                              )}
                            </div>
                          </label>
                          <div className="form-grid">
                            <label className="field">
                              <span>추가 상품 품번</span>
                              <input
                                value={winnerAddition.sku}
                                onChange={(e) =>
                                  setWinnerAddition((v: any) => ({ ...v, sku: e.target.value }))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>추가 상품명</span>
                              <input
                                value={winnerAddition.name}
                                onChange={(e) =>
                                  setWinnerAddition((v: any) => ({ ...v, name: e.target.value }))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>Option 1개당 추가수량</span>
                              <input
                                type="number"
                                min="1"
                                value={winnerAddition.unitQty}
                                onChange={(e) =>
                                  setWinnerAddition((v: any) => ({
                                    ...v,
                                    unitQty: Number(e.target.value),
                                  }))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>예측 청구무게(g/개)</span>
                              <input
                                type="number"
                                min="1"
                                value={winnerAddition.chargeWeight}
                                onChange={(e) =>
                                  setWinnerAddition((v: any) => ({
                                    ...v,
                                    chargeWeight: Number(e.target.value),
                                  }))
                                }
                              />
                            </label>
                          </div>
                          <small className="field-hint">
                            가격은 예시 기준 1로 기록합니다. 추가 상품 품번은 이번 결과에서만
                            사용하며 인벤토리 마스터에는 등록하지 않습니다.
                          </small>
                        </>
                      )}
                    </div>
                  </div>
                )}
                <p className="md-method-hint">
                  MD 혼합 포장은 박스 용량 15,000을 기준으로 계산합니다. 예: 10개/박스 상품 1개 =
                  용량 1,500.
                </p>
                <button className="primary full md-run" disabled={busy || loading} onClick={run}>
                  {busy ? <LoaderCircle className="spin" size={19} /> : <Truck size={19} />}분할하고
                  배송비 예측하기
                  <ArrowRight size={18} />
                </button>
              </div>
            </section>
          )}
        </div>
        <div className="md-results-column">
          <section className="panel md-results">
            <div className="panel-header">
              <div>
                <h2>가공·예측 결과</h2>
                <p>{current ? current.project : '업로드한 주문서를 검수할 수 있어요.'}</p>
              </div>
              {current && <span className="status green">개정 {current.revision}</span>}
            </div>
            {!result ? (
              <div className="result-empty">
                <ClipboardCheck size={48} />
                <h3>MD 주문서에서 예상 배송비까지</h3>
                <p>
                  예시로 체험하거나 주문서를 업로드한 뒤<br />
                  상품별 포장·무게 기준을 확인해주세요.
                </p>
                <span>원본 보존 → 박스 분할 → 국내·해외 비교</span>
              </div>
            ) : (
              <div className="form-body">
                <div className="result-numbers">
                  <div>
                    <span>분할 박스</span>
                    <b>
                      {num(result.boxCount)}
                      <small>개</small>
                    </b>
                  </div>
                  <div>
                    <span>가공 수량</span>
                    <b>
                      {num(result.qty)}
                      <small>개</small>
                    </b>
                  </div>
                  <div>
                    <span>확인 필요</span>
                    <b>
                      {num((result.issues?.length || 0) + (result.warnings?.length || 0))}
                      <small>건</small>
                    </b>
                  </div>
                </div>
                {result.reconciliation && (
                  <div className="md-balance">
                    <CheckCircle2 size={18} />
                    <span>
                      수량 검증 완료 · 원본 {num(result.reconciliation.originalQty)}개 − 취소{' '}
                      {num(result.reconciliation.excludedQty)}개 − 당첨자 차감{' '}
                      {num(result.deducted)}개 + 당첨자 추가 {num(result.addedQty || 0)}개 = 가공{' '}
                      {num(result.qty)}개
                    </span>
                  </div>
                )}
                {current.mode === 'album' && (
                  <div className="md-album-settings">
                    <h3>앨범 버전별 가공 수량</h3>
                    <div className="md-preview-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>버전 상품</th>
                            <th>가공 수량</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(result.inventory || [])
                            .filter(
                              (p: any) =>
                                !(result.winnerAdditionRows || []).some(
                                  (a: any) => a.sku === p.sku,
                                ),
                            )
                            .map((p: any) => (
                              <tr key={p.sku}>
                                <td>
                                  {p.name}
                                  <small>{p.sku}</small>
                                </td>
                                <td>{num(p.qty)}개</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {(result.deductionRows || []).length > 0 && (
                      <>
                        <h3>당첨자 차감 검수</h3>
                        <div className="md-preview-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>merchant_uid</th>
                                <th>차감 전</th>
                                <th>당첨 차감</th>
                                <th>가공 대상</th>
                                <th>Option</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.deductionRows.map((d: any, i: number) => (
                                <tr key={i}>
                                  <td>{d.order}</td>
                                  <td>{num(d.before)}</td>
                                  <td>{num(d.deducted)}</td>
                                  <td>{num(d.after)}</td>
                                  <td>
                                    {(current.input.winners || [])
                                      .filter((w: any) => w.order === d.order)
                                      .map((w: any) => w.option || '당첨자')
                                      .join(' · ')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <small className="field-hint">
                          같은 merchant_uid에 서로 다른 당첨 Option이 있으면 Option별로 한 장씩
                          제외합니다. 당첨 주문번호 누락 또는 구매수량 초과는 가공 오류로
                          중단합니다.
                        </small>
                      </>
                    )}
                    {(result.winnerAdditionRows || []).length > 0 && (
                      <>
                        <h3>당첨자 추가 상품 검수</h3>
                        <div className="md-preview-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>merchant_uid</th>
                                <th>추가 상품</th>
                                <th>Option</th>
                                <th>수량</th>
                                <th>연결 박스</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.winnerAdditionRows.map((r: any, i: number) => (
                                <tr key={i}>
                                  <td>{r.order}</td>
                                  <td>
                                    {r.name}
                                    <small>{r.sku}</small>
                                  </td>
                                  <td>{r.options}</td>
                                  <td>{num(r.qty)}</td>
                                  <td>{r.box}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <h3 className="section-label">물류사별 예상 비용</h3>
                <div className="md-cost-cards">
                  {(result.basis?.contracts || state.contracts).map((c: any) => (
                    <article key={c.id}>
                      <small>{c.name}</small>
                      <strong>₩ {num(result.cost[c.id])}</strong>
                      <span>
                        {result.cost.complete ? '전체 박스 합계' : '운임이 있는 박스의 부분 합계'}
                      </span>
                      {result.cost.domestic && (
                        <dl>
                          <div>
                            <dt>국내 {result.cost.domestic.boxes}박스</dt>
                            <dd>₩ {num(result.cost.domestic[c.id])}</dd>
                          </div>
                          <div>
                            <dt>해외 {result.cost.international.boxes}박스</dt>
                            <dd>₩ {num(result.cost.international[c.id])}</dd>
                          </div>
                        </dl>
                      )}
                    </article>
                  ))}
                </div>
                {!result.empty && result.cost.complete ? (
                  <div className="recommendation">
                    <CheckCircle2 size={18} />
                    <span>
                      {result.cost.a === result.cost.b
                        ? '두 업체의 예상 비용이 같습니다.'
                        : (result.cost.a < result.cost.b ? '다보내' : '패스트박스') +
                          '가 예상 비용 ' +
                          num(Math.abs(result.cost.a - result.cost.b)) +
                          '원 유리합니다.'}{' '}
                      일정·작업 조건도 함께 확인해주세요.
                    </span>
                  </div>
                ) : (
                  <div className="warning-box">
                    <AlertTriangle size={18} />
                    <span>
                      {result.empty
                        ? '배송할 상품이 없어 비용 비교를 진행하지 않습니다.'
                        : '운임이 없는 박스가 있어 전체 비용 비교를 보류합니다.'}
                    </span>
                  </div>
                )}
                <p className="md-estimate-note">
                  등록된 청구무게와 계약 기준을 사용한 예상 금액입니다. 실제 청구 금액은 3PL 검수 후
                  확정됩니다.
                </p>
                <div className="md-review-tabs">
                  {['전체', '국내', '해외'].map((v) => (
                    <button key={v} className={tab === v ? 'active' : ''} onClick={() => setTab(v)}>
                      {v}
                    </button>
                  ))}
                </div>
                <div className="md-preview-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>분할 주문번호</th>
                        <th>상품</th>
                        <th>수량</th>
                        <th>국가</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.slice(0, 12).map((r: any, i: number) => (
                        <tr key={i}>
                          <td>{r.order}</td>
                          <td>
                            {r.name}
                            <small>{r.sku}</small>
                          </td>
                          <td>{num(r.qty)}</td>
                          <td>{r.country}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!shown.length && <p className="md-no-rows">해당 구분의 결과가 없습니다.</p>}
                </div>
                <small className="field-hint">
                  {num(shown.length)}행 중 최대 12행 미리보기 · 다운로드에는 전체 결과가 포함됩니다.
                </small>
                <details className="md-box-details">
                  <summary>박스별 무게·예상 비용 확인 ({result.boxes.length}박스)</summary>
                  <div className="md-preview-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>박스</th>
                          <th>국가</th>
                          <th>적용 무게</th>
                          <th>다보내</th>
                          <th>패박</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.boxes.slice(0, 30).map((b: any) => (
                          <tr key={b.order}>
                            <td>{b.order}</td>
                            <td>{b.country}</td>
                            <td>{num(b.billableWeight || Math.ceil(b.weight / 500) * 500)}g</td>
                            <td>{b.a === null ? '미산정' : num(b.a) + '원'}</td>
                            <td>{b.b === null ? '미산정' : num(b.b) + '원'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
                {((result.issues?.length || 0) > 0 || result.warnings.length > 0) && (
                  <details className="md-validation" open>
                    <summary>
                      <AlertTriangle size={17} />
                      확인 필요 항목
                    </summary>
                    {result.warnings.map((w: string, i: number) => (
                      <p key={'w' + i}>{w}</p>
                    ))}
                    {result.issues?.slice(0, 20).map((v: any, i: number) => (
                      <p key={i}>
                        {v.row}행 · {v.order} · {v.message}
                      </p>
                    ))}
                  </details>
                )}
                <h3 className="section-label">검수용 주문서 XLSX 다운로드</h3>
                <p className="field-hint">
                  국내·해외 파일마다 주문서, 박스별 예상 비용, 상품별 가공 수량, 당첨자 차감·추가
                  내역을 시트로 나눠 담습니다.
                </p>
                <div className="download-grid">
                  <button
                    className="secondary"
                    disabled={!result.rows.some((r: any) => r.country === 'KR')}
                    onClick={() => exportWorkbook('국내')}
                  >
                    <Download size={15} />
                    국내 XLSX
                  </button>
                  <button
                    className="secondary"
                    disabled={!result.rows.some((r: any) => r.country !== 'KR')}
                    onClick={() => exportWorkbook('해외')}
                  >
                    <Download size={15} />
                    해외 XLSX
                  </button>
                </div>
                <div className="md-extra-downloads">
                  <button
                    className="text-btn"
                    onClick={() =>
                      download(
                        current!.input.rows.map((r: any) =>
                          r.source && Object.keys(r.source).length
                            ? r.source
                            : {
                                주문번호: r.order,
                                재고코드: r.sku,
                                수량: r.qty,
                                국가코드: r.country,
                              },
                        ),
                        current!.project + '_원본.csv',
                      )
                    }
                  >
                    원본
                  </button>
                  <button
                    className="text-btn"
                    onClick={() => download(boxRows, current!.project + '_박스별_예상비용.csv')}
                  >
                    비용 상세
                  </button>
                  <button
                    className="text-btn"
                    onClick={() =>
                      download(
                        (result.inventory || []).map((p: any) => ({
                          품번: p.sku,
                          상품명: p.name,
                          출고수량: p.qty,
                        })),
                        current!.project + '_상품별_수량.csv',
                      )
                    }
                  >
                    상품별 수량
                  </button>
                </div>
                <button
                  className="text-btn reprocess"
                  disabled={busy}
                  onClick={() => reprocess(current!)}
                >
                  <RefreshCw size={15} />
                  현재 계약 기준으로 재처리
                </button>
              </div>
            )}
          </section>
          <section className="panel job-history">
            <div className="panel-header">
              <h2>저장된 가공 작업</h2>
              <span>{state.jobs.length}건</span>
            </div>
            {state.jobs.slice(0, 6).map((j) => (
              <button
                key={j.id}
                onClick={() => {
                  setActive(j.id);
                  setTab('전체');
                }}
              >
                <FileSpreadsheet size={18} />
                <div>
                  <b>{j.project}</b>
                  <small>
                    {j.mode === 'md' ? 'MD' : '앨범'} · {j.result.boxCount}박스 · 개정 {j.revision}
                  </small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
            {!state.jobs.length && (
              <p className="muted small">가공 결과와 당시 계산 기준이 함께 저장됩니다.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
