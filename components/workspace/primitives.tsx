'use client';
import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Package, X } from 'lucide-react';

export function Status({ value }: { value: string }) {
  return (
    <span
      className={
        'status ' +
        ((value.endsWith('완료') && value !== '입력완료') || value === '승인' || value === '정상'
          ? 'green'
          : value.includes('배송')
            ? 'blue'
            : value.includes('논의')
              ? 'purple'
              : value === '취소' || value === '반려' || value === '품절' || value === '이슈 해결 중'
                ? 'red'
                : 'amber')
      }
    >
      <i />
      {value}
    </span>
  );
}
export function Empty({ text = '표시할 항목이 없습니다.' }: { text?: string }) {
  return (
    <div className="empty">
      <Package size={30} />
      <b>{text}</b>
      <span>새로운 요청이나 조건을 확인해 주세요.</span>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  guided = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  guided?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && !guided) {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,a[href]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      document.removeEventListener('keydown', handler);
      prev?.focus();
    };
  }, [guided]);
  return createPortal(
    <div className={'modal-backdrop' + (guided ? ' is-guided' : '')} onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal={!guided}
        aria-label={title}
        className={'modal ' + (wide ? 'wide' : '')}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <small>KNOWMERCE FLOW</small>
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" aria-label="닫기" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <em>*</em>}
      </span>
      {children}
    </label>
  );
}
