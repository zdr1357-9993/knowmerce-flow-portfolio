'use client';
import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { State, today } from '../lib/model';
import { periods, weekSegments, dateAdd } from '../lib/calendar';
export default function CompanyCalendar({
  state,
  onOpen,
  compact = false,
  onDetails,
}: {
  state: State;
  onOpen: (id: string) => void;
  compact?: boolean;
  onDetails?: () => void;
}) {
  const [month, setMonth] = useState(new Date().getMonth()),
    [year, setYear] = useState(new Date().getFullYear()),
    [selected, setSelected] = useState('');
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`,
    first = prefix + '-01',
    last = prefix + '-' + String(new Date(year, month + 1, 0).getDate()).padStart(2, '0');
  const all = periods(state),
    shown = all
      .filter((p) => p.start <= last && p.end >= first)
      .sort((a, b) => a.start.localeCompare(b.start)),
    offset = new Date(first + 'T00:00:00Z').getUTCDay(),
    weeks = Math.ceil((offset + Number(last.slice(-2))) / 7),
    start = dateAdd(first, -offset);
  const centers = [
      '다보내',
      '패박',
      ...(shown.some((p) => p.center === '미배정') ? ['미배정'] : []),
    ],
    color = (center: string) =>
      center === '다보내' ? 'dabo' : center === '패박' ? 'fast' : 'unassigned';
  function next(n: number) {
    const d = new Date(year, month + n, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected('');
  }
  return (
    <div className={'company-calendar lane-calendar ' + (compact ? 'compact' : '')}>
      <section className="panel company-calendar-main">
        <div className="panel-header">
          <div>
            <h2>전사 입출고 캘린더</h2>
            <p>
              입고·출고를 네 줄로 나누고 <b>← 진행 기간 →</b>을 연결합니다. 내 일정은 굵게
              표시됩니다.
            </p>
          </div>
          <div className="calendar-title">
            <button className="icon-btn" aria-label="이전 달" onClick={() => next(-1)}>
              <ChevronLeft size={18} />
            </button>
            <b>
              {year}년 {month + 1}월
            </b>
            <button className="icon-btn" aria-label="다음 달" onClick={() => next(1)}>
              <ChevronRight size={18} />
            </button>
            {compact && (
              <button className="small-button" onClick={onDetails}>
                상세보기
              </button>
            )}
          </div>
        </div>
        <div className="calendar-legend">
          <span>
            <i className="provider-dot dabo" />
            다보내
          </span>
          <span>
            <i className="provider-dot fast" />
            패박
          </span>
          <span>1·2줄 입고 / 출고</span>
          <span>3·4줄 입고 / 출고</span>
          <span className="muted">기간: 요청일 ~ 완료예상일</span>
        </div>
        <div className="lane-calendar-scroll">
          <div className="lane-calendar-board">
            <div className="lane-weekdays">
              <span />
              {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            {Array.from({ length: weeks }, (_, w) => {
              const week = dateAdd(start, w * 7);
              return (
                <section className="lane-week" key={week}>
                  <div className="lane-dates">
                    <span />
                    {Array.from({ length: 7 }, (_, i) => {
                      const d = dateAdd(week, i);
                      return (
                        <button
                          key={d}
                          className={
                            (d.startsWith(prefix) ? '' : 'outside ') +
                            (d === today() ? 'today ' : '') +
                            (d === selected ? 'selected' : '')
                          }
                          onClick={() => setSelected(selected === d ? '' : d)}
                        >
                          {Number(d.slice(-2))}
                        </button>
                      );
                    })}
                  </div>
                  {centers.flatMap((center) =>
                    ['입고', '출고'].map((type) => {
                      const segments = weekSegments(all, week, center, type),
                        rows = Math.max(1, ...segments.map((s) => s.row + 1));
                      return (
                        <div
                          className={'calendar-lane ' + color(center)}
                          key={center + type}
                          aria-label={`${week} ${center} ${type}`}
                        >
                          <span className="lane-label" title={`${center} ${type}`}>
                            <i className={'provider-dot ' + color(center)} />
                            {type}
                          </span>
                          <div
                            className="lane-track"
                            style={{ gridTemplateRows: `repeat(${rows},34px)` }}
                          >
                            {segments.map((s) => (
                              <button
                                key={s.id}
                                className={
                                  'period-bar ' +
                                  color(center) +
                                  (s.request.owner === state.actorId ? ' my-project' : '') +
                                  (s.continuesBefore ? ' continues-before' : '') +
                                  (s.continuesAfter ? ' continues-after' : '')
                                }
                                style={{
                                  gridColumn: `${s.from + 1} / span ${s.span}`,
                                  gridRow: s.row + 1,
                                }}
                                title={`${s.request.project} · ${s.start} ~ ${s.end}`}
                                onClick={() => onOpen(s.request.id)}
                                aria-label={`${s.request.project} ${type} ${s.start}부터 ${s.end}까지`}
                              >
                                <span className="period-arrow">{s.start !== s.end ? '←' : ''}</span>
                                <span>{s.request.project}</span>
                                <span className="period-arrow">{s.start !== s.end ? '→' : ''}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }),
                  )}
                </section>
              );
            })}
          </div>
        </div>
        <div className="panel-foot">
          업체명은 색상 범례로 구분합니다. 미배정 건은 별도 줄에 표시하며 완료예상일이 없으면 하루
          일정으로 표시합니다.
        </div>
      </section>
      {!compact && (
        <aside className="panel month-guide">
          <div className="panel-header">
            <div>
              <h2>{month + 1}월 일정 안내</h2>
              <p>월 전체 · {new Set(shown.map((p) => p.request.id)).size}개 물류 요청</p>
            </div>
          </div>
          {selected && (
            <div className="selected-date-hint">
              {selected} 진행 중인 일정을 강조합니다.
              <button onClick={() => setSelected('')}>선택 해제</button>
            </div>
          )}
          <div className="month-guide-grid">
            {centers.map((center) => (
              <section className={'provider-group ' + color(center)} key={center}>
                <h3>
                  <i className={'provider-dot ' + color(center)} />
                  {center}
                </h3>
                <div className="provider-directions">
                  {['입고', '출고'].map((type) => (
                    <div key={type}>
                      <h4>
                        {type}{' '}
                        <span>
                          {shown.filter((p) => p.center === center && p.type === type).length}
                        </span>
                      </h4>
                      {shown
                        .filter((p) => p.center === center && p.type === type)
                        .map((p) => (
                          <button
                            className={
                              'month-project ' +
                              (p.request.owner === state.actorId ? 'my-project ' : '') +
                              (selected && p.start <= selected && p.end >= selected
                                ? 'selected-date'
                                : '')
                            }
                            key={p.id}
                            onClick={() => onOpen(p.request.id)}
                          >
                            <time>
                              {p.start.slice(5)}
                              {p.end !== p.start ? ` ↔ ${p.end.slice(5)}` : ''}
                            </time>
                            <span>{p.request.project}</span>
                            <small>
                              {state.actors.find((a) => a.id === p.request.owner)?.name} ·{' '}
                              {p.request.status}
                            </small>
                          </button>
                        ))}
                      {!shown.some((p) => p.center === center && p.type === type) && (
                        <p className="no-schedule">일정 없음</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          {!shown.length && (
            <div className="empty">
              <CalendarDays size={30} />
              <b>이달의 승인된 일정이 없습니다.</b>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
