// ============================================================
// SummaryArchiveScreen — "browse past daily summaries"
// ------------------------------------------------------------
// Wired to the Summary tab in the bottom nav. Shows a compact
// daily summary for any selected date, reconstructed on-the-fly
// from the append-only `runs` log. No new persistence layer —
// runs are the source of truth, and we aggregate them per-day
// when the user picks a date.
//
// Layout:
//   * Header: back + "Summary Archive" + (Today jump when off-today)
//   * Date navigator: ◀ [calendar button with date label] ▶
//       - Tapping the date button expands a month calendar with
//         dots on days that have tracked runs. Clicking a dotted
//         day loads its summary.
//       - Arrow buttons walk day-by-day (next disabled on today,
//         since future days have nothing to show).
//   * Body: totals + time-by-panel + timeline, or an empty state
//     when no runs exist on the selected day.
//
// Deleted panels: runs that reference a panel instance that was
// later deleted still render — we show "Deleted panel" in slate
// so the historical time isn't silently dropped.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useNav } from '../../lib/previewNav';
import {
  addDaysIso,
  endOfDay,
  formatLongDate,
  formatMonthYear,
  getMonthGrid,
  getUsedDateSet,
  startOfDay,
  todayIso,
} from '../../lib/dateUtils';
import {
  BREAK_PANEL_ID,
  IDLE_PANEL_ID,
  LUNCH_PANEL_ID,
} from '../../lib/panelCatalog';
import { formatHM } from '../../lib/summaryModel';

// ============================================================
// Main screen
// ============================================================

export const SummaryArchiveScreen: React.FC = () => {
  const { navigate, runs, panels } = useNav();

  // Which day's summary is currently rendered. Starts on today.
  const [selectedIso, setSelectedIso] = useState<string>(() => todayIso());
  // Whether the calendar popover under the date navigator is open.
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Which month the calendar is showing. Driven independently of
  // selectedIso so the user can browse forward/back without losing
  // their current date selection.
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const today = todayIso();
  const isToday = selectedIso === today;

  // Dots in the calendar come from the full runs log — we compute
  // this once and pass it into the calendar popover. break/lunch/
  // idle runs count as "used" here since they still represent a
  // day the app was open.
  const usedDates = useMemo(() => getUsedDateSet(runs), [runs]);

  // Runs that fall inside the selected day. Clipped to the local
  // 00:00–23:59 window so a run that straddles midnight doesn't
  // leak hours into the wrong day.
  const dayRuns = useMemo(() => {
    const startMs = startOfDay(selectedIso).getTime();
    const endMs = endOfDay(selectedIso).getTime();
    return runs
      .filter(r => r.endedAt > startMs && r.startedAt < endMs)
      .map(r => ({
        ...r,
        startedAt: Math.max(r.startedAt, startMs),
        endedAt: Math.min(r.endedAt, endMs),
      }))
      .sort((a, b) => a.startedAt - b.startedAt);
  }, [runs, selectedIso]);

  // panelId → { name, barClass } lookup built from live panel
  // instances. Historical runs that point at a deleted instance
  // fall through and render with a slate "Deleted panel" label.
  const panelLookup = useMemo(() => {
    const map = new Map<string, { name: string; barClass: string }>();
    for (const p of panels) {
      map.set(p.id, { name: p.name, barClass: p.barClass });
    }
    return map;
  }, [panels]);

  // Aggregate panel work time and break time in one pass.
  const { workEntries, totalWorkMs, breakMs } = useMemo(() => {
    const totals = new Map<string, number>();
    let breakAccum = 0;
    for (const r of dayRuns) {
      const ms = r.endedAt - r.startedAt;
      if (r.panelId === BREAK_PANEL_ID || r.panelId === LUNCH_PANEL_ID) {
        breakAccum += ms;
        continue;
      }
      if (r.panelId === IDLE_PANEL_ID) continue;
      totals.set(r.panelId, (totals.get(r.panelId) ?? 0) + ms);
    }
    const entries: Array<{
      panelId: string;
      name: string;
      barClass: string;
      ms: number;
      missing: boolean;
    }> = [];
    for (const [panelId, ms] of totals) {
      const meta = panelLookup.get(panelId);
      entries.push({
        panelId,
        name: meta?.name ?? 'Deleted panel',
        barClass: meta?.barClass ?? 'bg-slate-300',
        ms,
        missing: !meta,
      });
    }
    entries.sort((a, b) => b.ms - a.ms);
    const totalMs = entries.reduce((s, e) => s + e.ms, 0);
    return { workEntries: entries, totalWorkMs: totalMs, breakMs: breakAccum };
  }, [dayRuns, panelLookup]);

  const hasData = dayRuns.length > 0;

  // Day stepping. Next is gated to today — the user can't land
  // on a future day because there's no data to show.
  const goPrev = () => setSelectedIso(prev => addDaysIso(prev, -1));
  const goNext = () => {
    setSelectedIso(prev => {
      const next = addDaysIso(prev, 1);
      return next > today ? prev : next;
    });
  };
  const goToday = () => setSelectedIso(today);

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300"
            aria-label="Back"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Reports
            </p>
            <h1 className="text-lg font-bold text-slate-900 truncate">
              Summary Archive
            </h1>
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={goToday}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 shrink-0"
            >
              Today
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        {/* ===== Date navigator ===== */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-3">
            <button
              type="button"
              onClick={goPrev}
              className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 shrink-0"
              aria-label="Previous day"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setCalendarOpen(o => !o)}
              className="flex-1 min-w-0 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 flex items-center gap-2"
              aria-expanded={calendarOpen}
            >
              <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="text-sm font-semibold text-slate-900 truncate flex-1 text-left">
                {formatLongDate(selectedIso)}
              </span>
              <svg
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${calendarOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={isToday}
              className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              aria-label="Next day"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {calendarOpen && (
            <CalendarPanel
              month={calMonth}
              setMonth={setCalMonth}
              selectedIso={selectedIso}
              usedDates={usedDates}
              onSelect={iso => {
                setSelectedIso(iso);
                setCalendarOpen(false);
              }}
            />
          )}
        </section>

        {/* ===== Summary body ===== */}
        {!hasData ? (
          <section className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">
              No tracked time
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Nothing was tracked on this day. Try the arrows or pick another
              day from the calendar — dotted days have runs.
            </p>
          </section>
        ) : (
          <>
            {/* ----- Totals card ----- */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Tracked work
              </p>
              <p className="text-3xl font-extrabold text-slate-900 tabular-nums">
                {formatHM(totalWorkMs)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Across {workEntries.length} panel
                {workEntries.length === 1 ? '' : 's'}
                {breakMs > 0 && ` · ${formatHM(breakMs)} on breaks`}
              </p>
            </section>

            {/* ----- Time by panel ----- */}
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <header className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900">
                  Time by Panel
                </h2>
              </header>
              <ul>
                {workEntries.map((e, i) => {
                  const pct =
                    totalWorkMs > 0
                      ? Math.round((e.ms / totalWorkMs) * 100)
                      : 0;
                  return (
                    <li
                      key={e.panelId}
                      className={`px-5 py-4 ${i < workEntries.length - 1 ? 'border-b border-slate-100' : ''}`}
                    >
                      <div className="flex items-center gap-3 mb-1.5">
                        <span
                          className={`w-3 h-3 rounded-full ${e.barClass} shrink-0`}
                          aria-hidden
                        />
                        <span
                          className={`text-sm font-semibold flex-1 truncate ${e.missing ? 'text-slate-400 italic' : 'text-slate-900'}`}
                        >
                          {e.name}
                        </span>
                        <span className="text-sm font-semibold text-slate-600 tabular-nums shrink-0">
                          {formatHM(e.ms)}
                        </span>
                        <span className="text-xs text-slate-400 tabular-nums w-10 text-right shrink-0">
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${e.barClass}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* ----- Timeline ----- */}
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <header className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900">Timeline</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {dayRuns.length} segment{dayRuns.length === 1 ? '' : 's'}
                </p>
              </header>
              <ul>
                {dayRuns.map(r => {
                  const isBreak =
                    r.panelId === BREAK_PANEL_ID ||
                    r.panelId === LUNCH_PANEL_ID;
                  const meta = panelLookup.get(r.panelId);
                  let label: string;
                  let barClass: string;
                  let italic = false;
                  if (r.panelId === LUNCH_PANEL_ID) {
                    label = 'Lunch';
                    barClass = 'bg-slate-300';
                    italic = true;
                  } else if (r.panelId === BREAK_PANEL_ID) {
                    label = 'Break';
                    barClass = 'bg-slate-300';
                    italic = true;
                  } else if (r.panelId === IDLE_PANEL_ID) {
                    label = 'Idle';
                    barClass = 'bg-slate-200';
                    italic = true;
                  } else if (meta) {
                    label = meta.name;
                    barClass = meta.barClass;
                  } else {
                    label = 'Deleted panel';
                    barClass = 'bg-slate-300';
                    italic = true;
                  }
                  const startLabel = new Date(r.startedAt).toLocaleTimeString(
                    undefined,
                    { hour: 'numeric', minute: '2-digit' },
                  );
                  const endLabel = new Date(r.endedAt).toLocaleTimeString(
                    undefined,
                    { hour: 'numeric', minute: '2-digit' },
                  );
                  const durMs = r.endedAt - r.startedAt;
                  return (
                    <li
                      key={r.id}
                      className="px-5 py-3 border-b border-slate-100 last:border-b-0 flex items-center gap-3"
                    >
                      <span
                        className={`w-1.5 h-8 rounded-full ${barClass} shrink-0`}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm truncate ${italic ? 'text-slate-500 italic' : 'font-semibold text-slate-900'}`}
                        >
                          {label}
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {startLabel} – {endLabel}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-slate-600 tabular-nums shrink-0">
                        {formatHM(durMs)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* ----- CTA back to the prepare flow -----
                For *today*, let the user jump into the formal Prepare
                Summary flow (audience, style, generate). The archive
                is meant for browsing; Prepare is for composing. */}
            {isToday && !isBreakOnly(workEntries.length) && (
              <button
                type="button"
                onClick={() => navigate('prepare-summary')}
                className="w-full px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2"
              >
                Generate today's report
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
};

/** Utility so the CTA doesn't show on "break-only" days. */
function isBreakOnly(workPanelCount: number): boolean {
  return workPanelCount === 0;
}

// ============================================================
// Calendar popover
// ============================================================

interface CalendarPanelProps {
  month: { year: number; month: number };
  setMonth: (m: { year: number; month: number }) => void;
  selectedIso: string;
  usedDates: Set<string>;
  onSelect: (iso: string) => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const CalendarPanel: React.FC<CalendarPanelProps> = ({
  month,
  setMonth,
  selectedIso,
  usedDates,
  onSelect,
}) => {
  const cells = useMemo(
    () => getMonthGrid(month.year, month.month),
    [month.year, month.month],
  );
  const monthLabel = formatMonthYear(month.year, month.month);
  const today = todayIso();

  const prevMonth = () => {
    const d = new Date(month.year, month.month - 1, 1);
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
  };
  const nextMonth = () => {
    const d = new Date(month.year, month.month + 1, 1);
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <div className="border-t border-slate-100 px-4 md:px-5 py-4 bg-slate-50">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center text-slate-500 hover:text-slate-900"
          aria-label="Previous month"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-sm font-bold text-slate-900">{monthLabel}</p>
        <button
          type="button"
          onClick={nextMonth}
          className="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center text-slate-500 hover:text-slate-900"
          aria-label="Next month"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((d, i) => (
          <div
            key={i}
            className="text-[10px] font-semibold text-slate-400 text-center uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(cell => {
          const isUsed = usedDates.has(cell.iso);
          const isSelected = cell.iso === selectedIso;
          const isFuture = cell.iso > today;
          const base =
            'aspect-square rounded-lg text-xs font-medium flex flex-col items-center justify-center relative transition-colors';
          let classes: string;
          if (isSelected) {
            classes = `${base} bg-slate-900 text-white`;
          } else if (isFuture) {
            classes = `${base} text-slate-300 cursor-not-allowed`;
          } else if (!cell.inMonth) {
            classes = `${base} text-slate-300 hover:bg-white`;
          } else {
            classes = `${base} text-slate-700 hover:bg-white`;
          }
          if (cell.isToday && !isSelected) {
            classes += ' ring-1 ring-blue-400';
          }
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => !isFuture && onSelect(cell.iso)}
              disabled={isFuture}
              className={classes}
              aria-label={cell.iso}
              aria-current={isSelected ? 'date' : undefined}
            >
              <span>{cell.day}</span>
              {isUsed && (
                <span
                  className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-200 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-blue-500" />
          Tracked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded ring-1 ring-blue-400" />
          Today
        </span>
      </div>
    </div>
  );
};
