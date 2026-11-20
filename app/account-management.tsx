'use client';
import { useState } from 'react';
import { useEditorReveal } from '../hooks/use-editor-reveal';
import { UserPlus, KeyRound, ShieldCheck, X } from 'lucide-react';
import { State, Actor, roleLabel } from '../lib/model';
export default function AccountManagement({
  state,
  busy,
  onSave,
}: {
  state: State;
  busy: boolean;
  onSave: (action: string, data: any, success: string) => Promise<State | false | undefined>;
}) {
  const [form, setForm] = useState<any>(null),
    [error, setError] = useState(''),
    [revealToken, setRevealToken] = useState(0);
  const editorRef = useEditorReveal(revealToken);
  const reset = !!form?.id;
  function open(a?: Actor) {
    setRevealToken((n) => n + 1);
    setError('');
    setForm(
      a
        ? { id: a.id, login: a.login, name: a.name, password: '', confirm: '' }
        : { login: '', password: '', confirm: '', name: '', role: 'requester', team: '' },
    );
  }
  return (
    <>
      <div className="notice-banner">
        <ShieldCheck size={24} />
        <div>
          <b>물류 어드민이 계정을 직접 발급합니다.</b>
          <p>
            비밀번호는 해시로 저장됩니다. 생성·초기화 후 임시 비밀번호를 전달하면 사용자가 첫
            로그인에서 새 비밀번호를 설정합니다.
          </p>
        </div>
        <button className="primary" onClick={() => open()}>
          <UserPlus size={17} />
          계정 만들기
        </button>
      </div>
      <section className="panel">
        <div className="panel-header">
          <h2>
            계정 목록 <span>{state.actors.filter((a) => a.login).length}</span>
          </h2>
          <p>체험용 계정과 직접 발급한 계정을 구분합니다.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th>역할</th>
                <th>팀</th>
                <th>비밀번호 상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {state.actors.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.login || a.id}
                    <small className="block">{a.login ? '발급 계정' : '체험 계정'}</small>
                  </td>
                  <td>{a.name}</td>
                  <td>{roleLabel[a.role]}</td>
                  <td>{a.team}</td>
                  <td>
                    {a.login ? (a.mustReset ? '첫 로그인 설정 필요' : '설정 완료') : '체험용'}
                  </td>
                  <td>
                    {a.login ? (
                      <button className="secondary" onClick={() => open(a)}>
                        <KeyRound size={15} />
                        비밀번호 초기화
                      </button>
                    ) : (
                      <span className="muted small">체험 계정 · 초기화 제외</span>
                    )}
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
              <h2 tabIndex={-1}>{reset ? '비밀번호 초기화' : '새 계정 만들기'}</h2>
              <p>{reset ? form.name + ' · ' + form.login : '발급할 사용자 정보를 입력해주세요.'}</p>
            </div>
            <button className="icon-btn" onClick={() => setForm(null)} aria-label="계정 입력 닫기">
              <X />
            </button>
          </div>
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              if (form.password !== form.confirm) {
                setError('비밀번호가 일치하지 않습니다.');
                return;
              }
              const result = await onSave(
                reset ? 'account-reset' : 'account-create',
                form,
                reset
                  ? '임시 비밀번호로 초기화했습니다. 사용자에게 전달해주세요.'
                  : '계정을 만들었습니다. ID와 임시 비밀번호를 사용자에게 전달해주세요.',
              );
              if (result) {
                setForm(null);
                if (reset && form.id === state.actorId) window.location.assign('/login');
              }
            }}
          >
            {!reset && (
              <div className="form-grid">
                <label className="field">
                  <span>ID</span>
                  <input
                    required
                    autoComplete="off"
                    pattern="[A-Za-z0-9][A-Za-z0-9._-]{3,39}"
                    maxLength={40}
                    value={form.login}
                    onChange={(e) => setForm({ ...form, login: e.target.value })}
                  />
                  <small className="field-hint">영문·숫자·점·밑줄·하이픈 4~40자</small>
                </label>
                <label className="field">
                  <span>이름</span>
                  <input
                    required
                    maxLength={80}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>역할</span>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    {Object.entries(roleLabel).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>팀</span>
                  <input
                    required
                    maxLength={80}
                    value={form.team}
                    onChange={(e) => setForm({ ...form, team: e.target.value })}
                  />
                </label>
              </div>
            )}
            <div className="form-grid">
              <label className="field">
                <span>임시 비밀번호</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <small className="field-hint">8~128자 · 사용자 첫 로그인 시 변경</small>
              </label>
              <label className="field">
                <span>임시 비밀번호 확인</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                />
              </label>
            </div>
            {reset && (
              <p className="warning-box">
                초기화하면 기존 로그인 세션이 해제됩니다. 임시 비밀번호를 안전하게 전달해주세요.
              </p>
            )}
            {error && (
              <p role="alert" className="login-error">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setForm(null)}>
                닫기
              </button>
              <button className="primary" disabled={busy}>
                {busy ? '저장 중…' : reset ? '비밀번호 초기화·저장' : '계정 생성'}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
