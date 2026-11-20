'use client';
import {
  Product,
  RequestItem,
  requestItems,
  inboundMethods,
  inboundAttributes,
  outboundReasons,
  today,
} from '../lib/model';
import { Plus, Save, Info, Send } from 'lucide-react';
export const emptyLine = () => ({ sku: '', qty: '', barcode: '' });
export function requestForm(r?: RequestItem) {
  const items = r ? requestItems(r).map((x) => ({ ...x })) : [];
  while (items.length < 5) items.push(emptyLine() as any);
  return r
    ? { ...r, items, method: r.method || '', inboundAttribute: r.inboundAttribute || '' }
    : {
        type: '입고',
        date: today(),
        project: '',
        method: '',
        inboundAttribute: '',
        note: '',
        time: '',
        transport: '',
        country: '',
        reason: '',
        recipient: '',
        phone: '',
        address: '',
        items,
      };
}
export default function RequestForm({
  form,
  products,
  person,
  onChange,
  onSave,
  onCancel,
  onDirect,
  busy,
  editing,
  allowZero = false,
}: {
  form: any;
  products: Product[];
  person: string;
  onChange: (key: string, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
  onDirect: () => void;
  busy: boolean;
  editing?: boolean;
  allowZero?: boolean;
}) {
  const cell = (index: number, key: string, value: string) =>
    onChange(
      'items',
      form.items.map((x: any, i: number) =>
        i === index
          ? {
              ...x,
              [key]: value,
              ...(key === 'sku'
                ? { barcode: products.find((p) => p.sku === value.trim())?.barcode || '' }
                : {}),
            }
          : x,
      ),
    );
  function paste(text: string, index: number) {
    const rows = text
      .replace(/^\uFEFF/, '')
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((x) => x.split('\t'));
    if (rows.length === 1 && rows[0].length === 1) return false;
    const header = rows[0].findIndex((x) =>
      ['품번', 'sku', '재고코드'].includes(x.trim().toLowerCase()),
    );
    const data = header >= 0 ? rows.slice(1) : rows;
    const parsed = data.map((cols) => {
      const raw =
        header >= 0 ? cols[header] : cols.find((c) => /^\d{6}$/.test(c.trim())) || cols[0];
      const sku = String(raw || '').trim();
      return { ...emptyLine(), sku, barcode: products.find((p) => p.sku === sku)?.barcode || '' };
    });
    if (index + parsed.length > 100) {
      alert('상품은 최대 100행까지 입력할 수 있습니다.');
      return true;
    }
    const next = [...form.items];
    for (let n = 0; n < parsed.length; n++)
      next[index + n] = { ...(next[index + n] || emptyLine()), ...parsed[n] };
    onChange('items', next);
    return true;
  }
  const field = (label: string, key: string, type = 'text', required = false) => (
    <label className="field">
      <span>
        {label}
        {required && <em>*</em>}
      </span>
      <input type={type} value={form[key] || ''} onChange={(e) => onChange(key, e.target.value)} />
    </label>
  );
  return (
    <form
      className="modal-body request-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className="request-project-first">
        <label className="field">
          <span>
            물류 요청 이름<em>*</em>
          </span>
          <input
            value={form.project || ''}
            required
            placeholder="물류 요청 이름을 입력하세요"
            onChange={(e) => onChange('project', e.target.value)}
          />
        </label>
      </div>
      <div className="request-steps">
        <span className="active">01 정보 입력</span>
        <i />
        <span>02 입력완료 · 확인</span>
        <i />
        <span>03 물류팀 요청</span>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>
            요청 유형<em>*</em>
          </span>
          <select
            value={form.type}
            disabled={!!form.id}
            onChange={(e) => {
              onChange('type', e.target.value);
              onChange('method', '');
              onChange('reason', '');
              onChange('inboundAttribute', '');
            }}
          >
            <option>입고</option>
            <option>출고</option>
          </select>
        </label>
        {field(`${form.type} 요청일`, 'date', 'date', true)}
        <label className="field">
          <span>요청자</span>
          <input readOnly className="applicant-readonly" value={person} />
        </label>
        {form.type === '입고' ? (
          <>
            <label className="field">
              <span>
                입고방식 <small>(선택)</small>
              </span>
              <select
                value={form.method || ''}
                onChange={(e) => onChange('method', e.target.value)}
              >
                <option value="">방식 선택</option>
                {inboundMethods.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="field span-2">
              <span>상품 입고 속성 · 전체 상품 적용</span>
              <select
                value={form.inboundAttribute || ''}
                onChange={(e) => onChange('inboundAttribute', e.target.value)}
              >
                <option value="">입고 속성 선택</option>
                {inboundAttributes.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <small className="field-hint">
                선택한 입고 속성은 이 요청의 모든 상품에 동일하게 적용됩니다.
              </small>
            </label>
          </>
        ) : (
          <label className="field">
            <span>
              출고 사유<em>*</em>
            </span>
            <select value={form.reason || ''} onChange={(e) => onChange('reason', e.target.value)}>
              <option value="">출고 사유 선택</option>
              {outboundReasons.map((v) => (
                <option key={v}>{v}</option>
              ))}
              {form.reason && !outboundReasons.includes(form.reason) && (
                <option value={form.reason}>기존 기록: {form.reason}</option>
              )}
            </select>
          </label>
        )}
      </div>
      <div className="issuance-caption">
        <h3>{form.type} 상품</h3>
        <p>
          품번을 입력하거나 발번 결과를 붙여넣으세요. 상품 정보는 등록된 품번을 기준으로 채워집니다.
        </p>
      </div>
      <div className="table-wrap request-items-table">
        <table>
          <thead>
            <tr>
              <th>
                품번 <em>*</em>
              </th>
              <th>상품이름</th>
              <th>프로젝트</th>
              <th>상품 속성</th>
              <th>
                수량 <em>*</em>
              </th>
              <th>바코드(선택)</th>
            </tr>
          </thead>
          <tbody>
            {form.items.map((line: any, i: number) => {
              const p = products.find((p) => p.sku === line.sku.trim());
              return (
                <tr key={i}>
                  <td>
                    <input
                      aria-label={`품번 ${i + 1}`}
                      value={line.sku}
                      placeholder="품번 입력 / 붙여넣기"
                      onChange={(e) => cell(i, 'sku', e.target.value)}
                      onPaste={(e) => {
                        if (paste(e.clipboardData.getData('text'), i)) e.preventDefault();
                      }}
                    />
                    {line.sku && !p && <small className="row-error">등록되지 않은 품번</small>}
                  </td>
                  <td>
                    <input
                      aria-label={`상품이름 ${i + 1}`}
                      readOnly
                      value={p?.name || ''}
                      placeholder="자동 입력"
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`프로젝트 ${i + 1}`}
                      readOnly
                      value={p?.project || ''}
                      placeholder="자동 입력"
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`상품 속성 ${i + 1}`}
                      readOnly
                      value={p?.category || ''}
                      placeholder="자동 입력"
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`수량 ${i + 1}`}
                      type="number"
                      min={allowZero ? 0 : 1}
                      step="1"
                      value={line.qty}
                      placeholder="0"
                      onChange={(e) => cell(i, 'qty', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`바코드 ${i + 1}`}
                      value={line.barcode || ''}
                      placeholder="선택 입력"
                      onChange={(e) => cell(i, 'barcode', e.target.value)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        className="secondary full add-product-row"
        type="button"
        disabled={form.items.length >= 100}
        onClick={() => onChange('items', [...form.items, emptyLine()])}
      >
        <Plus size={15} />
        상품 행 추가
      </button>
      <label className="field">
        <span>비고(특이사항)</span>
        <textarea
          rows={2}
          value={form.note || ''}
          onChange={(e) => onChange('note', e.target.value)}
        />
      </label>
      <div className="form-grid">
        {field(`${form.type} 예정시간`, 'time', 'time')}
        {field('차량정보 / 송장번호', 'transport')}
        {field('국가(수입시)', 'country')}
        {form.type === '입고' && field('사유', 'reason')}
        {form.type === '출고' && (
          <>
            {field('받는 사람', 'recipient', 'text', true)}
            {field('연락처', 'phone', 'text', true)}
            <div className="span-2">{field('도착지 주소', 'address', 'text', true)}</div>
          </>
        )}
      </div>
      <div className="soft-info save-guidance">
        <Info size={20} />
        <strong>
          {editing
            ? '수정 내용은 히스토리에 기록됩니다.'
            : '‘저장’만으로는 요청되지 않습니다. 저장 후 정보를 확인하고 ‘요청’을 눌러주세요.'}
        </strong>
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          취소
        </button>
        <button className="secondary save-request-button" disabled={busy}>
          <Save size={16} />
          {busy ? '저장 중…' : '저장'}
        </button>
        {!editing && (
          <button
            type="button"
            className="primary direct-request-button"
            disabled={busy}
            onClick={onDirect}
          >
            <Send size={16} />
            바로 요청
          </button>
        )}
      </div>
    </form>
  );
}
