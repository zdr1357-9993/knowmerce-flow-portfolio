'use client';
import { useEffect, useRef } from 'react';
export function useEditorReveal(openToken: number) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!openToken) return;
    const frame = requestAnimationFrame(() => {
      const editor = ref.current;
      if (!editor) return;
      const guide = document.querySelector('.guide-panel');
      const offset = (guide?.getBoundingClientRect().bottom || 0) + 20;
      const top = Math.max(0, window.scrollY + editor.getBoundingClientRect().top - offset);
      editor.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
      window.scrollTo({
        top,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [openToken]);
  return ref;
}
