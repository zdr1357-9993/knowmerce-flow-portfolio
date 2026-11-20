'use client';
import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
export default function PasswordSetup() {
  const [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <main className="password-setup">
      <section className="panel">
        <span className="round-icon lilac">
          <LockKeyhole />
        </span>
        <h1>새 비밀번호 설정</h1>
        <p>임시 비밀번호로 로그인했습니다. 사용할 비밀번호를 설정해주세요.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const r = await fetch('/api/password-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, confirm }),
              });
              const d: any = await r.json();
              if (!r.ok) throw Error(d.error);
              window.location.assign('/');
            } catch (e: any) {
              setError(e.message);
              setBusy(false);
            }
          }}
        >
          <label className="field">
            <span>새 비밀번호</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="field">
            <span>새 비밀번호 확인</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? '설정 중…' : '비밀번호 설정 후 시작'}
          </button>
        </form>
      </section>
    </main>
  );
}
