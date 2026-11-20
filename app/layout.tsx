import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'KNOWMERCE Flow · 통합 물류 워크스페이스',
  description: '입출고 요청과 승인, 일정, 재고 이력, 주문서 자동화와 비용 비교를 연결합니다.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
