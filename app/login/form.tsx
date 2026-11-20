'use client';
import { useState } from 'react';
import { LockKeyhole, ArrowRight, LoaderCircle } from 'lucide-react';
export default function LoginForm() {
  const [login, setLogin] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <main className="review-login">
      <section className="review-login-story">
        <a className="brand" href="/login">
          <span className="brand-mark">K</span>
          <b>
            KNOWMERCE <em>Flow</em>
          </b>
        </a>
        <div>
          <span className="review-kicker">LOGISTICS WORKSPACE</span>
          <h1>
            물류의 모든 흐름을,
            <br />
            한곳에서.
          </h1>
          <p>
            요청과 승인부터 일정, 재고, 변경 이력까지.
            <br />
            knowmerce의 물류 업무를 경험해보세요.
          </p>
          <div className="review-flow">
            <span>요청</span>
            <ArrowRight />
            <span>승인</span>
            <ArrowRight />
            <span>입출고</span>
          </div>
        </div>
        <small>검토용 프로토타입 · 예시 데이터</small>
      </section>
      <section className="review-login-panel">
        <div className="review-login-card">
          <span className="round-icon lilac">
            <LockKeyhole size={25} />
          </span>
          <h2>물류 워크스페이스 로그인</h2>
          <p>안내받은 아이디와 비밀번호를 입력해주세요.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError('');
              try {
                const response = await fetch('/api/review-login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ login, password }),
                });
                const data: any = await response.json();
                if (!response.ok) throw new Error(data.error || '로그인할 수 없습니다.');
                window.location.assign(data.next || '/');
              } catch (e: any) {
                setError(e.message);
                setBusy(false);
              }
            }}
          >
            <label className="field">
              <span>아이디</span>
              <input
                name="username"
                autoComplete="username"
                required
                autoFocus
                maxLength={120}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="아이디를 입력하세요"
              />
            </label>
            <label className="field">
              <span>비밀번호</span>
              <input
                name="password"
                autoComplete="current-password"
                type="password"
                required
                maxLength={256}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
              />
            </label>
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}{' '}
              {busy ? '확인 중…' : '로그인'}
            </button>
          </form>
          <p className="review-login-footnote">
            계정이 없는 경우 직접 물류팀에게 요청하세요.
            <br />
            비밀번호를 잊었다면 물류 어드민에게 초기화를 요청해주세요.
          </p>
        </div>
      </section>
    </main>
  );
}
