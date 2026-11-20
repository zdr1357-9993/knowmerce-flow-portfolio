'use client';
import { useState } from 'react';
import { useEditorReveal } from '../hooks/use-editor-reveal';
import { ShieldCheck, UserPlus, KeyRound, X } from 'lucide-react';
import { State, Actor, roleLabel } from '../lib/model';
export default function DemoAccountManagement({
  state,
  onPreview,
}: {
  state: State;
  onPreview: (mode: 'create' | 'reset') => void;
}) {
  const [form, setForm] = useState<{ mode: 'create' | 'reset'; target?: Actor } | null>(null),
    [notice, setNotice] = useState(''),
    [revealToken, setRevealToken] = useState(0);
  const editorRef = useEditorReveal(revealToken);
  function open(mode: 'create' | 'reset', target?: Actor) {
    setNotice('');
    setForm({ mode, target });
    setRevealToken((n) => n + 1);
  }
  return (
    <section className="account-management-demo">
      <div className="notice-banner">
        <ShieldCheck size={24} />
        <div>
          <b>물류 어드민 · 계정 관리 화면</b>
          <p>
            계정 목록과 생성·비밀번호 초기화 화면을 살펴보세요. 이 체험은 실제 계정이나 비밀번호를
            만들거나 변경하지 않습니다.
          </p>
        </div>
        <button className="primary" onClick={() => open('create')}>
          <UserPlus size={17} />
          계정 만들기
        </button>
      </div>
      <section className="panel">
        <div className="panel-header">
          <h2>
            계정 목록 <span>{state.actors.length}</span>
          </h2>
          <p>가상 계정 · ID·이름·역할·팀</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th>역할</th>
                <th>팀</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {state.actors.map((a) => (
                <tr key={a.id}>
                  <td>{a.login || a.id}</td>
                  <td>{a.name}</td>
                  <td>{roleLabel[a.role]}</td>
                  <td>{a.team}</td>
                  <td>
                    <button
                      className="secondary"
                      onClick={() => open('reset', a)}
                      aria-label={`${a.name} 비밀번호 초기화`}
                    >
                      <KeyRound size={15} />
                      비밀번호 초기화
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {form && (
        <section className="panel account-editor" ref={editorRef}>
          <div className="panel-header">
            <div>
              <h2 tabIndex={-1}>
                {form.mode === 'create'
                  ? '새 계정 만들기 · 화면 예시'
                  : '비밀번호 초기화 · 화면 예시'}
              </h2>
              <p>
                {form.mode === 'create'
                  ? '사용자 정보와 권한을 설정하는 화면입니다.'
                  : '대상: ' + form.target?.name + ' / ' + form.target?.id}
              </p>
            </div>
            <button className="icon-btn" aria-label="계정 예시 닫기" onClick={() => setForm(null)}>
              <X size={20} />
            </button>
          </div>
          <form
            className="modal-body"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              onPreview(form.mode);
              setNotice(
                form.mode === 'create'
                  ? '계정 생성 안내를 확인했습니다. 실제 계정은 생성되지 않습니다.'
                  : '비밀번호 초기화 안내를 확인했습니다. 실제 비밀번호와 로그인 상태는 변경되지 않습니다.',
              );
              setForm(null);
            }}
          >
            {form.mode === 'create' ? (
              <div className="form-grid">
                <label className="field">
                  <span>ID</span>
                  <input defaultValue="sample_user" autoComplete="off" />
                  <small>중복 ID는 생성 전에 확인하도록 설계합니다.</small>
                </label>
                <label className="field">
                  <span>이름</span>
                  <input defaultValue="예시 사용자" autoComplete="off" />
                </label>
                <label className="field">
                  <span>역할</span>
                  <select defaultValue="requester">
                    {Object.entries(roleLabel).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>팀</span>
                  <input defaultValue="상품기획팀" autoComplete="off" />
                </label>
              </div>
            ) : (
              <div className="soft-info">
                <KeyRound size={18} />
                <span>
                  {form.target?.name}님의 비밀번호를 초기화하는 안내 화면입니다. 실제 초기화 요청은
                  전송하지 않습니다.
                </span>
              </div>
            )}
            <div className="form-grid">
              <label className="field">
                <span>{form.mode === 'reset' ? '새 비밀번호' : '비밀번호'}</span>
                <input type="password" readOnly value="DEMO-ONLY" aria-label="비밀번호 화면 예시" />
                <small>실제 비밀번호를 입력하지 않는 화면 예시입니다.</small>
              </label>
              <label className="field">
                <span>비밀번호 확인</span>
                <input type="password" readOnly value="DEMO-ONLY" />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setForm(null)}>
                취소
              </button>
              <button className="primary">
                {form.mode === 'create' ? '생성 안내 보기' : '초기화 안내 보기'}
              </button>
            </div>
          </form>
        </section>
      )}
      {notice && (
        <div className="account-demo-result" role="status">
          <ShieldCheck size={22} />
          <div>
            <b>{notice}</b>
            <p>계정 관리 가이드의 다음 안내로 이동할 수 있습니다.</p>
          </div>
        </div>
      )}
    </section>
  );
}
