import { State, RequestItem, projectCenters } from './model';
export type Period = {
  id: string;
  request: RequestItem;
  center: string;
  type: string;
  start: string;
  end: string;
};
export type Segment = Period & {
  from: number;
  span: number;
  row: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};
export function periods(s: State): Period[] {
  return s.requests
    .filter((r) => r.approved && !['반려', '취소'].includes(r.status))
    .flatMap((r) =>
      projectCenters(s, r).map((center) => ({
        id: r.id + center,
        request: r,
        center,
        type: r.type,
        start: r.date,
        end: r.expectedCompletion && r.expectedCompletion >= r.date ? r.expectedCompletion : r.date,
      })),
    );
}
export function dateAdd(date: string, n: number) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekSegments(all: Period[], week: string, center: string, type: string): Segment[] {
  const end = dateAdd(week, 6),
    occupied: number[] = [];
  return all
    .filter((p) => p.center === center && p.type === type && p.start <= end && p.end >= week)
    .sort(
      (a, b) =>
        a.start.localeCompare(b.start) || b.end.localeCompare(a.end) || a.id.localeCompare(b.id),
    )
    .map((p) => {
      const from =
          p.start < week ? 0 : Math.round((Date.parse(p.start) - Date.parse(week)) / 86400000),
        to = p.end > end ? 6 : Math.round((Date.parse(p.end) - Date.parse(week)) / 86400000);
      let row = occupied.findIndex((last) => last < from);
      if (row < 0) row = occupied.length;
      occupied[row] = to;
      return {
        ...p,
        from,
        span: to - from + 1,
        row,
        continuesBefore: p.start < week,
        continuesAfter: p.end > end,
      };
    });
}
