// ============================================================
// dateUtils — small, timezone-aware date helpers
// ------------------------------------------------------------
// The rest of the app stores timestamps as epoch ms (from
// Date.now() / run.startedAt). Any "which day is this?" question
// is local-time, not UTC — if I track work at 11pm Pacific, that
// should land on today in the calendar, not tomorrow in UTC.
//
// All functions here operate in the user's local timezone. ISO
// strings are plain "YYYY-MM-DD" — no time component, no Z.
// This makes day-level comparisons and Set keys cheap and
// lexically sortable.
//
// Centralized so the SummaryArchive calendar + date navigator
// don't reinvent date math in three places.
// ============================================================

import type { Run } from './panelCatalog';

/** Return "YYYY-MM-DD" for the given moment, in local time. */
export function toIsoDate(input: Date | number): string {
  const d = typeof input === 'number' ? new Date(input) : input;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Parse "YYYY-MM-DD" back into a local-midnight Date. */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Local midnight at the start of the given ISO date. */
export function startOfDay(iso: string): Date {
  return fromIsoDate(iso);
}

/** Local 23:59:59.999 at the end of the given ISO date. */
export function endOfDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/** Shift an ISO date by N days (positive = forward). */
export function addDaysIso(iso: string, delta: number): string {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + delta);
  return toIsoDate(d);
}

/** Today's ISO date in the user's local timezone. */
export function todayIso(): string {
  return toIsoDate(new Date());
}

/** Long, humanized date label, e.g. "Monday, April 14, 2026". */
export function formatLongDate(iso: string): string {
  return fromIsoDate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "April 2026" for the calendar header. */
export function formatMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Collect every ISO date that has at least one run. Used to dot the
 * calendar — we include break/lunch/idle runs here too since they
 * still represent "a day the app was used". The Set gives O(1)
 * membership checks when rendering the 42-cell calendar grid.
 */
export function getUsedDateSet(runs: Run[]): Set<string> {
  const set = new Set<string>();
  for (const r of runs) {
    set.add(toIsoDate(r.startedAt));
  }
  return set;
}

/** One cell in a calendar month grid. */
export interface MonthGridCell {
  /** "YYYY-MM-DD" for this cell in local time. */
  iso: string;
  /** The day-of-month number (1-31) to display. */
  day: number;
  /** True if this cell belongs to the currently-viewed month
   *  (false for leading/trailing days from adjacent months). */
  inMonth: boolean;
  /** True if this cell is today's date. */
  isToday: boolean;
}

/**
 * Build a 6-row × 7-col (42 cell) calendar grid starting on Sunday.
 * Cells outside the target month are included so the calendar always
 * fills a rectangle — the `inMonth` flag lets the renderer dim them.
 */
export function getMonthGrid(year: number, month: number): MonthGridCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = firstOfMonth.getDay(); // 0 = Sunday
  const today = todayIso();
  const cells: MonthGridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const cell = new Date(year, month, 1 - firstWeekday + i);
    const iso = toIsoDate(cell);
    cells.push({
      iso,
      day: cell.getDate(),
      inMonth: cell.getMonth() === month,
      isToday: iso === today,
    });
  }
  return cells;
}
