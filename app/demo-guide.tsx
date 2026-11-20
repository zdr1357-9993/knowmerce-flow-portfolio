'use client';
import { useEffect, useRef } from 'react';
import { ArrowRight, CheckCircle2, Compass, X } from 'lucide-react';
export type GuideCase =
  | 'inbound'
  | 'outbound'
  | 'product'
  | 'change'
  | 'album'
  | 'md'
  | 'admin'
  | 'accounts';
export const guideCases: { id: GuideCase; title: string; description: string }[] = [
  {
    id: 'inbound',
    title: '입고 요청부터 재고 반영',
    description: '요청자 작성 → 물류 승인 → 일정 → 입고 완료·이력',
  },
  {
    id: 'outbound',
    title: '출고 요청부터 배송 완료',
    description: '수령 정보 → 승인 → 배송 중 → 출고 완료',
  },
  {
    id: 'product',
    title: '새 상품 발번과 정보 보완',
    description: '요청자 발번 → 인벤토리 → 물류 담당자 정보 수정',
  },
  {
    id: 'change',
    title: '요청 내용 수정과 승인',
    description: '요청자 수정 요청 → 물류 담당자 검토 → 변경 이력',
  },
  {
    id: 'album',
    title: '앨범 주문서 자동화',
    description: '예시 주문 → 당첨분·분할·추가 설정 → 실행·결과',
  },
  {
    id: 'md',
    title: 'MD 주문서 자동화',
    description: '예시 주문 → 용량·청구무게 확인 → 실행·결과',
  },
  { id: 'admin', title: '운영 기준 관리', description: '어드민 전환 → 계약·운임 → 상시판매 기준' },
  {
    id: 'accounts',
    title: '물류 어드민 · 계정 관리',
    description: '계정 목록 → 새 계정 화면 → 비밀번호 초기화 안내',
  },
];
export type GuideStep = {
  title: string;
  body: string;
  result: string;
  target: string;
  required?: boolean;
};
export function guideSteps(kind: GuideCase): GuideStep[] {
  if (kind === 'inbound' || kind === 'outbound') {
    const incoming = kind === 'inbound',
      label = incoming ? '입고' : '출고';
    return [
      {
        title: '요청자 · 기존 상품 찾기',
        body: '인벤토리에서 품번 300001을 검색하고 상품 이름·보관처·현재 재고를 확인하세요. 이미 등록된 상품은 같은 코드를 사용합니다.',
        result: '상품을 다시 등록하지 않고 기존 품번으로 요청합니다.',
        target: '.inventory-table, .inventory-grid, .table-wrap',
      },
      {
        title: `요청자 · ${label} 정보 작성 후 저장`,
        body: `‘예시 화면 열기’를 누르면 ${label} 예시가 채워집니다. 상품과 수량 10개, 날짜${incoming ? '·상품 입고 속성' : '·출고 사유·수령인·연락처·주소'}를 확인하고 ‘저장’을 누르세요. 저장은 물류팀 요청과 다릅니다.`,
        result: '‘입력완료’로 저장되면 3/7 정보 검토·요청 안내로 자동 이동합니다.',
        target: '.request-form',
        required: true,
      },
      {
        title: '요청자 · 저장한 정보 검토 후 요청',
        body: '저장 완료 안내를 닫고 상세 정보를 다시 확인하세요. 상세 화면에서 스크롤을 내려 하단의 ‘요청’을 눌러 물류팀에 전달하세요. 저장만 한 상태와 요청한 상태를 비교해보세요.',
        result: '상태가 ‘물류팀 확인 중’으로 변경됩니다.',
        target: '.drawer',
        required: true,
      },
      {
        title: '물류 담당자 · 내용 확인 후 승인',
        body: '왼쪽 ‘체험 역할’에서 ‘물류 담당자’를 직접 눌러 전환하세요. 상단 알림의 ‘요청 확인’ 또는 대시보드의 ‘확인이 필요한 요청’에서 방금 제출한 요청을 여세요. 상품·수량·일정을 검토하고 ‘프로젝트 승인·일정 등록’ → ‘확인·진행’을 누르세요.',
        result:
          '승인이 완료되면 5/7 일정 확인으로 자동 이동합니다. ‘슬랙 논의 중’으로 변경하고 캘린더에 반영하며 실제 Slack 발송은 하지 않습니다.',
        target: '.demo-role-buttons',
        required: true,
      },
      {
        title: '전사 일정 · 자동 반영 확인',
        body: '방금 승인한 요청 이름이 캘린더에 나타나는지 확인하세요. 요청일과 일정이 연결되어 별도로 일정을 입력하지 않습니다.',
        result: '같은 요청을 캘린더에서 찾아 상세 내용을 열 수 있습니다.',
        target: '.company-calendar, .calendar-panel',
      },
      {
        title: `물류 담당자 · ${label} 완료`,
        body: incoming
          ? '상세 화면에서 스크롤을 내려 ‘물류 정보 수정’ 바로 아래의 파란색 ‘입고 완료’를 누르고 실입고 수량 10개를 확인한 뒤 ‘실수량 확인·완료’를 누르세요.'
          : '상세 화면에서 스크롤을 내려 ‘물류 정보 수정’ 바로 아래의 파란색 ‘배송 중’을 누르고 ‘확인·진행’을 누르세요. 이후 같은 위치에 나타나는 파란색 ‘출고 완료’를 누르고 실출고 수량 10개를 확인한 뒤 ‘실수량 확인·완료’를 누르세요.',
        result: `‘${label} 완료’가 되고 상품 재고에 ${incoming ? '10개가 더해' : '10개가 차감'}집니다.`,
        target: '.drawer',
        required: true,
      },
      {
        title: '인벤토리 · 재고와 이력 확인',
        body: '같은 상품의 상세 화면입니다. 현재 재고와 입출고 이력에서 방금 처리한 요청을 확인하세요. 왼쪽 역할을 바꾸면 요청자에게 보이는 정보도 비교할 수 있습니다.',
        result: '요청·일정·재고·처리 이력이 하나의 흐름으로 연결됩니다.',
        target: '.drawer',
      },
    ];
  }
  if (kind === 'accounts')
    return [
      {
        title: '물류 어드민 · 계정 만들기 화면',
        body: '계정 관리에서 ID·이름·역할·팀을 확인하세요. ‘계정 만들기’를 누르면 입력 화면이 열립니다. 역할과 팀을 살펴보고 ‘생성 안내 보기’를 누르세요.',
        result: '실제 계정 생성이나 서버 요청 없이 안내 화면만 확인합니다.',
        target: '.account-management-demo',
        required: true,
      },
      {
        title: '물류 어드민 · 비밀번호 초기화 안내',
        body: '계정 목록에서 한 명의 ‘비밀번호 초기화’를 누르세요. 대상 계정을 확인하고 ‘초기화 안내 보기’를 눌러보세요. 취소하면 입력 화면만 닫습니다.',
        result: '실제 비밀번호와 로그인 상태는 변경되지 않습니다.',
        target: '.account-management-demo',
        required: true,
      },
    ];
  if (kind === 'product')
    return [
      {
        title: '요청자 · 상품 코드 발번',
        body: '예시 화면에서 프로젝트·소유권·상품 이름·분류를 확인하고 ‘발번’을 누르세요. 빈 상품 행은 제외됩니다.',
        result: '상품이 새 품번으로 등록되고 발번 완료 창에 나타납니다.',
        target: '.issuance-form',
        required: true,
      },
      {
        title: '요청자 · 등록 결과 확인',
        body: '인벤토리에서 방금 발번한 상품을 확인하세요. 재고를 확인하지 않은 신규 상품은 0이 아니라 ‘- 개’로 표시됩니다.',
        result: '등록한 프로젝트·상품 이름과 품번을 확인합니다.',
        target: '.drawer',
      },
      {
        title: '물류 담당자 · 정보 수정과 기록',
        body: '‘인벤토리 정보 수정’에서 바코드·상품 속성·보관처·확인 수량과 변경 사유를 입력해 저장하세요. 기존 입력을 유지하려면 취소할 수 있습니다.',
        result: '수정 내용은 상품 변경 히스토리에 남습니다.',
        target: '.drawer',
        required: true,
      },
    ];
  if (kind === 'change')
    return [
      {
        title: '요청자 · 수정 요청 보내기',
        body: '본인이 제출한 예시 출고 요청입니다. ‘수정 요청’에서 수량을 320→321로 바꾸고 ‘현장 요청 수량 증가’와 같은 사유를 적어 보내세요.',
        result: '원본은 바로 바뀌지 않고 수정 요청이 대기 상태로 쌓입니다.',
        target: '.drawer',
        required: true,
      },
      {
        title: '물류 담당자 · 변경 검토',
        body: '수정 요청 대기 영역에서 해당 요청의 ‘변경 검토’를 누르세요. 전후 수량·일정·사유를 확인한 뒤 승인하세요.',
        result: '승인한 변경값이 요청에 반영되고 변경 이력이 남습니다.',
        target: '.changes-panel',
        required: true,
      },
      {
        title: '요청자 · 변경 결과 확인',
        body: '요청자의 화면으로 돌아왔습니다. 상세의 수량·일정과 변경 히스토리를 확인하세요. 다시 수정이 필요하면 별도의 수정 요청을 보냅니다.',
        result: '요청자와 물류 담당자가 같은 최신 정보를 확인합니다.',
        target: '.drawer',
      },
    ];
  if (kind === 'album' || kind === 'md')
    return [
      {
        title: `물류 담당자 · ${kind === 'album' ? '앨범' : 'MD'} 예시 불러오기`,
        body: `주문서 자동화에서 ‘${kind === 'album' ? '앨범' : 'MD'} 예시로 체험’ 버튼을 누르세요. 업로드 없이도 가상 주문으로 체험할 수 있습니다.`,
        result: '원본 주문과 상품 설정을 확인합니다.',
        target: '.order-automation',
      },
      {
        title: kind === 'album' ? '당첨분·박스 분할·추가 조건 확인' : '상품별 용량과 청구무게 확인',
        body:
          kind === 'album'
            ? '당첨자 차감·추가 설정과 버전별 상품, 박스당 수량을 확인하세요. 동일 주문에 여러 당첨 유형이 있으면 각각 반영합니다.'
            : '상품별 박스 용량과 청구무게를 확인하세요. 서로 다른 상품을 함께 포장하는 예시가 포함되어 있습니다.',
        result: '설정한 기준으로 실행할 준비를 합니다.',
        target: '.order-automation',
      },
      {
        title: '실행 후 결과·다운로드 확인',
        body: '‘분할하고 배송비 예측하기’를 누르세요. 결과의 박스 수·상품 수량을 확인하고 국내·해외 XLSX 다운로드를 눌러보세요. 예시 운임 기준의 계산이며 실제 출고는 하지 않습니다.',
        result: '성공한 작업이 결과와 작업 기록에 남습니다.',
        target: '.order-automation',
        required: true,
      },
    ];
  return [
    {
      title: '물류 어드민 · 계약·운임 관리',
      body: '왼쪽에서 물류 어드민 역할을 확인하세요. 계약·운임 관리에서 업체별 기준과 국가·무게 운임을 확인하고 수정 화면을 열어보세요.',
      result: '기준 변경 시 변경 사유와 기록을 남깁니다.',
      target: '.page-body',
    },
    {
      title: '물류 어드민 · 상시판매 기준',
      body: '상시판매에서 업체별 대상 상품과 적용 여부를 확인하세요. 역할을 물류 담당자·요청자로 바꿔 관리 메뉴의 차이도 확인할 수 있습니다.',
      result: '저장된 운영 기준과 상품을 함께 확인합니다. 실제 예약 출고는 실행하지 않습니다.',
      target: '.page-body',
    },
  ];
}
export default function DemoGuide({
  welcome,
  kind,
  index,
  step,
  done,
  busy,
  onStart,
  onSkip,
  onChoose,
  onNext,
  onBack,
  onOpen,
  onMenu,
  onClose,
}: {
  welcome: boolean;
  kind: GuideCase | null;
  index: number;
  step?: GuideStep;
  done: boolean;
  busy: boolean;
  onStart: () => void;
  onSkip: () => void;
  onChoose: (k: GuideCase) => void;
  onNext: () => void;
  onBack: () => void;
  onOpen: () => void;
  onMenu: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (welcome) {
      const d = dialog.current;
      d?.showModal();
      d?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
      if (d) d.scrollTop = 0;
    } else dialog.current?.close();
  }, [welcome]);
  useEffect(() => {
    if (!step) return;
    const t = setTimeout(() => {
      const el = document.querySelector(step.target);
      el?.classList.add('guide-target');
    }, 200);
    return () => {
      clearTimeout(t);
      document.querySelectorAll('.guide-target').forEach((e) => e.classList.remove('guide-target'));
    };
  }, [step]);
  return (
    <>
      <dialog
        className="guide-welcome"
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          onSkip();
        }}
      >
        <span className="guide-icon">
          <Compass size={30} />
        </span>
        <small>KNOWMERCE FLOW · 통합 물류 ERP 프로토타입</small>
        <h2 tabIndex={-1}>
          흩어진 물류 업무를
          <br />
          하나의 흐름으로 연결합니다.
        </h2>
        <p>
          ERP는 업무 정보를 같은 기준으로 관리하는 시스템입니다. Knowmerce Flow에서는 상품·재고,
          입출고 요청, 일정과 주문서 자동화를 함께 확인할 수 있습니다.
        </p>
        <div className="guide-role-intro">
          <article>
            <b>요청자</b>
            <p>상품을 찾고 입출고를 신청합니다. 일정·진행 상태를 조회하고 수정 요청을 보냅니다.</p>
          </article>
          <article>
            <b>물류 담당자</b>
            <p>요청을 확인·승인하고 입출고를 처리합니다. 재고와 변경 이력을 관리합니다.</p>
          </article>
          <article>
            <b>물류 어드민</b>
            <p>
              물류 업무에 더해 운영 기준과 계정을 관리합니다. 계정 관리는 화면 안내로 체험합니다.
            </p>
          </article>
        </div>
        <div className="guide-welcome-path">
          <span>요청자</span>
          <ArrowRight size={16} />
          <span>물류 담당자</span>
          <ArrowRight size={16} />
          <span>완료·이력</span>
        </div>
        <p className="guide-muted">
          가이드는 요청자부터 시작합니다. 가상 데이터로 진행하며 실제 배송·계정 생성은 하지
          않습니다. 왼쪽에서 역할을 바꿀 수 있어요.
        </p>
        <button className="primary full" onClick={onStart}>
          가이드 시작 <ArrowRight size={17} />
        </button>
        <button className="text-btn full" onClick={onSkip}>
          가이드 필요 없어요
        </button>
      </dialog>
      {!welcome && kind && step && (
        <section className="guide-panel" aria-label="주요 플로우 가이드" aria-live="polite">
          <div className="guide-step-title">
            <span>
              <Compass size={18} /> {guideCases.find((c) => c.id === kind)?.title} · {index + 1}/
              {guideSteps(kind).length}
            </span>
            <button onClick={onClose} className="icon-btn" aria-label="가이드 닫기">
              <X size={17} />
            </button>
          </div>
          <div className="guide-step-content">
            <div>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
              <small className={done && step.required ? 'guide-done' : ''}>
                {done && step.required && <CheckCircle2 size={14} />}{' '}
                {done && step.required ? '확인되었습니다. ' : ''}
                {step.result}
              </small>
            </div>
            <div className="guide-step-buttons">
              <button className="secondary" onClick={onOpen} disabled={busy}>
                예시 화면 열기
              </button>
              <button className="secondary" onClick={onBack} disabled={index === 0 || busy}>
                이전
              </button>
              <button
                className="primary"
                onClick={onNext}
                disabled={busy || (!!step.required && !done)}
              >
                {index === guideSteps(kind).length - 1 ? '사례 선택' : '다음 안내'}{' '}
                <ArrowRight size={15} />
              </button>
              <button className="text-btn" onClick={onMenu}>
                다른 사례 보기
              </button>
            </div>
          </div>
        </section>
      )}
      {!welcome && !kind && (
        <section className="guide-case-picker" aria-label="가이드 사례 선택">
          <div>
            <h2>어떤 흐름을 살펴볼까요?</h2>
            <button className="icon-btn" onClick={onClose} aria-label="가이드 닫기">
              <X size={18} />
            </button>
          </div>
          <div className="guide-case-grid">
            {guideCases.map((c) => (
              <button key={c.id} onClick={() => onChoose(c.id)}>
                <b>{c.title}</b>
                <span>{c.description}</span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
