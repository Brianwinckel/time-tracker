// ============================================================
// V6 Prepare Summary — pixel-faithful rebuild from concept HTML
// Concept: taskpanels.app/concepts/prepare-summary.html
// Shows "messier day" layout with all conditional states
// ============================================================

import React, { useEffect, useState, useMemo } from 'react';
import { useNav } from '../../lib/previewNav';
import type { Panel, PanelKind, MeetingType, MeetingAudience } from '../../lib/panelCatalog';
import {
  buildSummaryInput,
  type ReportKind,
  type Audience as SummaryAudience,
  type SummaryStyle as SummaryStyleKind,
  type SourceId,
  type ExternalDigest,
  type RunSegment,
} from '../../lib/summaryModel';

// Map Home's tailwind color name to a hex for downstream SVG fills.
// (MockPanel doesn't carry a hex, so we derive it here rather than
// polluting the catalog shape. Easy to replace when panels become real.)
const COLOR_HEX_BY_NAME: Record<string, string> = {
  blue: '#3b82f6',
  emerald: '#10b981',
  orange: '#f97316',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
};
const hexFor = (name: string): string => COLOR_HEX_BY_NAME[name] ?? '#64748b';

// ---- Types ----

type Audience = 'manager' | 'team' | 'client' | 'personal';
type SummaryStyle = 'concise' | 'standard' | 'detailed';
type PanelOutcome = 'completed' | 'in-progress' | 'blocked' | 'review' | 'follow-up' | 'abandoned';

// ---- Report range presets ----
//
// One unified picker for the report window. "Today" is the default and
// routes to the Daily Summary view; every other preset (and Custom)
// routes to the Performance Review view. This replaced a separate
// Report Type toggle + conditional Date Range section.
//
// Each preset resolves against "today" at the moment the screen is
// rendered, so Q1 always means Jan 1 → Mar 31 of the current year,
// YTD = Jan 1 → today, etc.

type RangePresetId =
  | 'today'
  | 'last7' | 'last30'
  | 'thisMonth' | 'lastMonth'
  | 'q1' | 'q2' | 'q3' | 'q4'
  | 'ytd' | 'lastYear'
  | 'custom';

// Past-range presets shown as chips below the Today card. "today" and
// "custom" are rendered separately (Today = hero card, Custom = inline
// date picker) so they aren't in this list.
const PAST_RANGE_PRESETS: { id: RangePresetId; label: string; labelShort: string }[] = [
  { id: 'last7',     label: 'Last 7 days',  labelShort: '7d'   },
  { id: 'last30',    label: 'Last 30 days', labelShort: '30d'  },
  { id: 'thisMonth', label: 'This month',   labelShort: 'MTD'  },
  { id: 'lastMonth', label: 'Last month',   labelShort: 'Last M' },
  { id: 'q1',        label: 'Q1',           labelShort: 'Q1'   },
  { id: 'q2',        label: 'Q2',           labelShort: 'Q2'   },
  { id: 'q3',        label: 'Q3',           labelShort: 'Q3'   },
  { id: 'q4',        label: 'Q4',           labelShort: 'Q4'   },
  { id: 'ytd',       label: 'Year to date', labelShort: 'YTD'  },
  { id: 'lastYear',  label: 'Last year',    labelShort: 'Last Y' },
];

function resolveRange(
  preset: RangePresetId,
  today: Date,
  custom: { start: Date; end: Date },
): { start: Date; end: Date } {
  const y = today.getFullYear();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  switch (preset) {
    case 'today':     return { start: startOfDay(today), end: endOfDay(today) };
    case 'last7':     return { start: startOfDay(new Date(y, today.getMonth(), today.getDate() - 6)), end: endOfDay(today) };
    case 'last30':    return { start: startOfDay(new Date(y, today.getMonth(), today.getDate() - 29)), end: endOfDay(today) };
    case 'thisMonth': return { start: new Date(y, today.getMonth(), 1), end: endOfDay(today) };
    case 'lastMonth': {
      const start = new Date(y, today.getMonth() - 1, 1);
      const end = endOfDay(new Date(y, today.getMonth(), 0));
      return { start, end };
    }
    case 'q1': return { start: new Date(y, 0, 1), end: endOfDay(new Date(y, 2, 31)) };
    case 'q2': return { start: new Date(y, 3, 1), end: endOfDay(new Date(y, 5, 30)) };
    case 'q3': return { start: new Date(y, 6, 1), end: endOfDay(new Date(y, 8, 30)) };
    case 'q4': return { start: new Date(y, 9, 1), end: endOfDay(new Date(y, 11, 31)) };
    case 'ytd': return { start: new Date(y, 0, 1), end: endOfDay(today) };
    case 'lastYear': return { start: new Date(y - 1, 0, 1), end: endOfDay(new Date(y - 1, 11, 31)) };
    case 'custom': return { start: startOfDay(custom.start), end: endOfDay(custom.end) };
  }
}

// Date ↔ <input type="date"> helpers. HTML date inputs speak
// ISO-8601 YYYY-MM-DD, which we also want to treat as local time (not
// UTC) so "2026-04-15" doesn't round-trip to Apr 14 in PT timezones.
const toISODateLocal = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
};
const fromISODateLocal = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

function formatRange({ start, end }: { start: Date; end: Date }): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const sameYear = start.getFullYear() === end.getFullYear();
  const s = start.toLocaleDateString(undefined, opts);
  const e = end.toLocaleDateString(undefined, { ...opts, year: sameYear ? undefined : 'numeric' });
  return sameYear && start.getFullYear() !== new Date().getFullYear()
    ? `${s} – ${e}, ${start.getFullYear()}`
    : `${s} – ${e}`;
}

interface FollowUpDetails {
  waitingOn: string;
  passedOffTo: string;
  nextStep: string;
}

interface PanelData {
  id: string;
  name: string;
  color: string;        // tailwind color name for the bar
  subtitle: string;
  time: string;
  included: boolean;
  outcome: PanelOutcome | null;
  // conditional fields
  followUp: FollowUpDetails;
  blocker: string;
  unrealizedEffort: boolean | null;
}

// ---- Outcome chip config ----

const OUTCOME_OPTIONS: {
  value: PanelOutcome;
  label: string;
  labelShort: string;
  selectedClass: string;
}[] = [
  { value: 'completed',   label: 'Completed',       labelShort: 'Completed',  selectedClass: 'selected-completed' },
  { value: 'in-progress', label: 'In Progress',     labelShort: 'In Progress', selectedClass: 'selected-progress' },
  { value: 'blocked',     label: 'Blocked',         labelShort: 'Blocked',    selectedClass: 'selected-blocked' },
  { value: 'review',      label: 'Needs Review',    labelShort: 'Review',     selectedClass: 'selected-review' },
  { value: 'follow-up',   label: 'Needs Follow-Up', labelShort: 'Follow-Up',  selectedClass: 'selected-followup' },
  { value: 'abandoned',   label: 'Abandoned',       labelShort: 'Abandoned',  selectedClass: 'selected-abandoned' },
];

// ---- Per-panel edits overlay ----
//
// Everything the user edits on this screen (outcome chips, include
// toggle, follow-up details, blocker text, abandoned effort choice)
// is stored keyed by panel id so the underlying session data — time,
// subtitle, name, color — can stay derived from NavContext.

interface PanelEdits {
  included: boolean;
  outcome: PanelOutcome | null;
  followUp: FollowUpDetails;
  blocker: string;
  unrealizedEffort: boolean | null;
}

const defaultEdits = (): PanelEdits => ({
  included: true,
  outcome: null,
  followUp: { waitingOn: '', passedOffTo: '', nextStep: '' },
  blocker: '',
  unrealizedEffort: null,
});

// ---- Source data ----

interface SourceData {
  id: string;
  label: string;
  labelShort: string;
  badge: string;
  on: boolean;
  colorBg: string;
  colorBorder: string;
  colorText: string;
  colorBadgeBg: string;
  colorBadgeText: string;
  colorCheck: string;
  icon: React.ReactNode;
}

// ---- Helper: border color for card based on outcome ----

function cardBorderClass(outcome: PanelOutcome | null): string {
  switch (outcome) {
    case 'follow-up': return 'border-purple-200';
    case 'blocked': return 'border-orange-200';
    case 'abandoned': return 'border-rose-200';
    default: return 'border-slate-200';
  }
}

// ---- Panel card components ----
//
// NOTE: These MUST live at module scope. When they were defined inside
// `PrepareSummaryScreen`, every parent re-render created a brand new
// component type, so React unmounted and remounted the `<input>` on
// every keystroke — inputs lost focus after exactly one character.

interface PanelCardHandlers {
  toggleIncluded: (id: string) => void;
  setOutcome: (id: string, outcome: PanelOutcome) => void;
  updateFollowUp: (id: string, field: keyof FollowUpDetails, value: string) => void;
  updateBlocker: (id: string, value: string) => void;
  setUnrealizedEffort: (id: string, value: boolean) => void;
}

const DesktopPanelCard: React.FC<{ panel: PanelData } & PanelCardHandlers> = ({
  panel, toggleIncluded, setOutcome, updateFollowUp, updateBlocker, setUnrealizedEffort,
}) => (
  <div className={`bg-white rounded-2xl border ${cardBorderClass(panel.outcome)} p-5 space-y-3`}>
    <div className="flex items-center gap-3">
      <div className={`w-1.5 h-10 rounded-full ${panel.color} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900">{panel.name}</h3>
          <button
            onClick={() => toggleIncluded(panel.id)}
            className={`include-toggle ${panel.included ? 'on' : 'off'} text-[10px] font-semibold px-2 py-0.5 rounded-full border`}
          >
            {panel.included ? 'Included' : 'Excluded'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{panel.subtitle}</p>
      </div>
      <span className="text-sm font-mono font-semibold text-slate-600 tabular-nums shrink-0">{panel.time}</span>
    </div>
    <div className="flex flex-wrap gap-1.5 pl-4">
      {OUTCOME_OPTIONS.map(opt => {
        const isSelected = panel.outcome === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setOutcome(panel.id, opt.value)}
            className={`outcome-chip px-3 py-1.5 rounded-lg border text-xs font-medium ${
              isSelected ? opt.selectedClass : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>

    {panel.outcome === 'follow-up' && (
      <div className="ml-4 bg-purple-50 rounded-xl border border-purple-200 p-4 space-y-2.5">
        <div>
          <label className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider block mb-1">Waiting on</label>
          <input
            type="text"
            value={panel.followUp.waitingOn}
            onChange={e => updateFollowUp(panel.id, 'waitingOn', e.target.value)}
            className="cond-input w-full h-9 px-3 bg-white border border-purple-200 rounded-lg text-xs text-slate-700 outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider block mb-1">Passed off to</label>
          <input
            type="text"
            value={panel.followUp.passedOffTo}
            onChange={e => updateFollowUp(panel.id, 'passedOffTo', e.target.value)}
            className="cond-input w-full h-9 px-3 bg-white border border-purple-200 rounded-lg text-xs text-slate-700 outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider block mb-1">Next step</label>
          <input
            type="text"
            value={panel.followUp.nextStep}
            onChange={e => updateFollowUp(panel.id, 'nextStep', e.target.value)}
            className="cond-input w-full h-9 px-3 bg-white border border-purple-200 rounded-lg text-xs text-slate-700 outline-none"
          />
        </div>
      </div>
    )}

    {panel.outcome === 'blocked' && (
      <div className="ml-4 bg-orange-50 rounded-xl border border-orange-200 p-4">
        <label className="text-[10px] font-semibold text-orange-700 uppercase tracking-wider block mb-1.5">
          What's blocking this? <span className="font-normal normal-case text-orange-400">optional</span>
        </label>
        <input
          type="text"
          value={panel.blocker}
          onChange={e => updateBlocker(panel.id, e.target.value)}
          className="cond-input w-full h-9 px-3 bg-white border border-orange-200 rounded-lg text-xs text-slate-700 outline-none"
        />
      </div>
    )}

    {panel.outcome === 'abandoned' && (
      <div className="ml-4 bg-amber-50 rounded-xl border border-amber-200 p-4">
        <p className="text-xs font-semibold text-amber-800 mb-2.5">Count as unrealized effort?</p>
        <div className="flex gap-2">
          <button
            onClick={() => setUnrealizedEffort(panel.id, true)}
            className={`effort-choice px-4 py-2 rounded-lg border text-xs font-medium ${
              panel.unrealizedEffort === true ? 'selected-yes' : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => setUnrealizedEffort(panel.id, false)}
            className={`effort-choice px-4 py-2 rounded-lg border text-xs font-medium ${
              panel.unrealizedEffort === false ? 'selected-no' : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            No
          </button>
        </div>
      </div>
    )}
  </div>
);

const MobilePanelCard: React.FC<{ panel: PanelData } & PanelCardHandlers> = ({
  panel, toggleIncluded, setOutcome, updateFollowUp, updateBlocker, setUnrealizedEffort,
}) => (
  <div className={`bg-white rounded-xl border ${cardBorderClass(panel.outcome)} p-3.5 space-y-2.5`}>
    <div className="flex items-center gap-2.5">
      <div className={`w-1 h-8 rounded-full ${panel.color} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-slate-900">{panel.name}</h3>
          <button
            onClick={() => toggleIncluded(panel.id)}
            className={`include-toggle ${panel.included ? 'on' : 'off'} text-[9px] font-semibold px-1.5 py-0.5 rounded-full border`}
          >
            {panel.included ? 'Incl.' : 'Excl.'}
          </button>
        </div>
        <p className="text-[10px] text-slate-400">{panel.subtitle} · {panel.time}</p>
      </div>
    </div>
    <div className="flex flex-wrap gap-1 pl-3.5">
      {OUTCOME_OPTIONS.map(opt => {
        const isSelected = panel.outcome === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setOutcome(panel.id, opt.value)}
            className={`outcome-chip px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
              isSelected ? opt.selectedClass : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            {opt.labelShort}
          </button>
        );
      })}
    </div>

    {panel.outcome === 'follow-up' && (
      <div className="ml-3.5 bg-purple-50 rounded-lg border border-purple-200 p-3 space-y-2">
        <div>
          <label className="text-[9px] font-semibold text-purple-600 uppercase tracking-wider block mb-0.5">Waiting on</label>
          <input
            type="text"
            value={panel.followUp.waitingOn}
            onChange={e => updateFollowUp(panel.id, 'waitingOn', e.target.value)}
            className="cond-input w-full h-8 px-2.5 bg-white border border-purple-200 rounded-md text-[11px] text-slate-700 outline-none"
          />
        </div>
        <div>
          <label className="text-[9px] font-semibold text-purple-600 uppercase tracking-wider block mb-0.5">Passed off to</label>
          <input
            type="text"
            value={panel.followUp.passedOffTo}
            onChange={e => updateFollowUp(panel.id, 'passedOffTo', e.target.value)}
            className="cond-input w-full h-8 px-2.5 bg-white border border-purple-200 rounded-md text-[11px] text-slate-700 outline-none"
          />
        </div>
        <div>
          <label className="text-[9px] font-semibold text-purple-600 uppercase tracking-wider block mb-0.5">Next step</label>
          <input
            type="text"
            value={panel.followUp.nextStep}
            onChange={e => updateFollowUp(panel.id, 'nextStep', e.target.value)}
            className="cond-input w-full h-8 px-2.5 bg-white border border-purple-200 rounded-md text-[11px] text-slate-700 outline-none"
          />
        </div>
      </div>
    )}

    {panel.outcome === 'blocked' && (
      <div className="ml-3.5 bg-orange-50 rounded-lg border border-orange-200 p-3">
        <label className="text-[9px] font-semibold text-orange-700 uppercase tracking-wider block mb-1">
          Blocker <span className="font-normal normal-case text-orange-400">optional</span>
        </label>
        <input
          type="text"
          value={panel.blocker}
          onChange={e => updateBlocker(panel.id, e.target.value)}
          className="cond-input w-full h-8 px-2.5 bg-white border border-orange-200 rounded-md text-[11px] text-slate-700 outline-none"
        />
      </div>
    )}

    {panel.outcome === 'abandoned' && (
      <div className="ml-3.5 bg-amber-50 rounded-lg border border-amber-200 p-3">
        <p className="text-[11px] font-semibold text-amber-800 mb-2">Count as unrealized effort?</p>
        <div className="flex gap-1.5">
          <button
            onClick={() => setUnrealizedEffort(panel.id, true)}
            className={`effort-choice px-3 py-1.5 rounded-lg border text-[11px] font-medium ${
              panel.unrealizedEffort === true ? 'selected-yes' : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => setUnrealizedEffort(panel.id, false)}
            className={`effort-choice px-3 py-1.5 rounded-lg border text-[11px] font-medium ${
              panel.unrealizedEffort === false ? 'selected-no' : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            No
          </button>
        </div>
      </div>
    )}
  </div>
);

// ---- Component ----

export const PrepareSummaryScreen: React.FC = () => {
  const {
    navigate,
    panels: allPanels,
    panelAccum,
    activeTimer,
    breakAccum,
    activeBreak,
    setCurrentSummary,
    saveSummary,
    runs,
    preferences,
    savedSummaries,
    pendingReportDate,
    setPendingReportDate,
  } = useNav();

  // When a pendingReportDate is set (user tapped "Generate report" from
  // Archive on a past day), we reconstruct the panel list and date window
  // from the raw runs log rather than from live state. Today = no override.
  const isHistorical = pendingReportDate !== null;
  const reportDate = pendingReportDate ?? null; // ISO or null

  // For historical dates, derive the panel list from the runs log:
  // find every unique panelId that has a run on that day, then look up
  // the matching Panel instance. Panels deleted since then won't appear
  // in the workstream editor, but their time still shows in the timeline.
  const historicalPanels: Panel[] = useMemo(() => {
    if (!reportDate) return [];
    const [y, mo, d] = reportDate.split('-').map(Number);
    const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0).getTime();
    const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999).getTime();
    const panelIds = new Set<string>();
    const nowMs = Date.now();
    for (const r of runs) {
      const end = r.endedAt ?? nowMs;
      if (end > dayStart && r.startedAt < dayEnd) {
        panelIds.add(r.panelId);
      }
    }
    // Filter to real panel instances (not sentinels like __break__).
    return allPanels.filter(p => panelIds.has(p.id));
  }, [reportDate, runs, allPanels]);

  // For today (non-historical), derive the same way — only panels that
  // have at least one run within the current calendar day, plus whichever
  // panel is actively timing right now (it may have no completed run yet).
  // This prevents zero-time panel instances from appearing in the workstream
  // list just because they were created at some point in the past.
  const todayPanels: Panel[] = useMemo(() => {
    const t = new Date();
    const dayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    const dayEnd = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999).getTime();
    const panelIds = new Set<string>();
    const nowMs = Date.now();
    for (const r of runs) {
      const end = r.endedAt ?? nowMs;
      if (end > dayStart && r.startedAt < dayEnd) {
        panelIds.add(r.panelId);
      }
    }
    // Include the currently-active panel even if its in-flight run hasn't
    // been banked yet (e.g. user opens Prepare Summary while a timer is live).
    if (activeTimer) panelIds.add(activeTimer.panelId);
    return allPanels.filter(p => panelIds.has(p.id));
  }, [runs, allPanels, activeTimer]);

  // Live Panel instances from the day (both still-running and marked done
  // by "End My Day"). These drive the workstream list on this screen.
  const livePanels: Panel[] = useMemo(
    () => isHistorical ? historicalPanels : todayPanels,
    [isHistorical, historicalPanels, todayPanels],
  );
  const activePanelIds = useMemo(
    () => livePanels.map(p => p.id),
    [livePanels],
  );
  const goHome = () => {
    // Clear the pending date so going back doesn't leave stale state.
    if (isHistorical) setPendingReportDate(null);
    navigate('home');
  };
  // ---- Local state ----
  const [audience, setAudience] = useState<Audience>(preferences.defaultAudience);
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>(preferences.defaultSummaryStyle);
  // Default to 'today' — the common case is a daily wrap-up. Any other
  // preset routes to the Performance Review view; there is no separate
  // Report Type toggle anymore.
  const [rangePreset, setRangePreset] = useState<RangePresetId>('today');
  // Custom range defaults to last 7 days → today. Only surfaced when
  // the user picks the "Custom..." chip.
  const [customStart, setCustomStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });
  const [customEnd, setCustomEnd] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });
  const resolvedRange = useMemo(
    () => resolveRange(rangePreset, new Date(), { start: customStart, end: customEnd }),
    [rangePreset, customStart, customEnd],
  );
  const rangeLabel = formatRange(resolvedRange);
  // "today" is the only preset that produces a Daily Summary — every
  // other preset (including Custom spanning a single day) goes to
  // Performance Review so multi-day affordances are always available.
  const isDaily = rangePreset === 'today';

  // Edits overlay — keyed by panel id, seeded lazily when a panel first
  // appears on this screen so re-visiting preserves what the user entered.
  const [edits, setEdits] = useState<Record<string, PanelEdits>>({});
  useEffect(() => {
    setEdits(prev => {
      let next = prev;
      for (const id of activePanelIds) {
        if (!next[id]) {
          if (next === prev) next = { ...prev };
          next[id] = defaultEdits();
        }
      }
      return next;
    });
  }, [activePanelIds]);

  // ---- Live tick so the displayed time keeps moving while a timer runs ----
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activeTimer && !activeBreak) return;
    const id = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [activeTimer, activeBreak]);

  // ---- Derive panel data from the real session ----
  // For historical days, accumulate from the runs log clipped to that day
  // rather than from panelAccum (which is all-time and today-biased).
  const historicalAccum: Record<string, number> = useMemo(() => {
    if (!reportDate) return {};
    const [y, mo, d] = reportDate.split('-').map(Number);
    const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0).getTime();
    const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999).getTime();
    const acc: Record<string, number> = {};
    const nowMs = Date.now();
    for (const r of runs) {
      const rEnd = r.endedAt ?? nowMs;
      if (rEnd <= dayStart || r.startedAt >= dayEnd) continue;
      const s = Math.max(r.startedAt, dayStart);
      const e = Math.min(rEnd, dayEnd);
      acc[r.panelId] = (acc[r.panelId] ?? 0) + (e - s);
    }
    return acc;
  }, [reportDate, runs]);

  const getPanelMs = (id: string): number => {
    if (isHistorical) return historicalAccum[id] ?? 0;
    const accum = panelAccum[id] ?? 0;
    if (activeTimer && activeTimer.panelId === id) {
      return accum + (Date.now() - activeTimer.startedAt);
    }
    return accum;
  };
  const formatHM = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 60000));
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h === 0 ? `${m}m` : `${h}h ${m}m`;
  };
  const subtitleFor = (p: Panel): string => {
    const parts = [p.project, p.workType, p.focusNote].filter(
      (s): s is string => typeof s === 'string' && s.trim().length > 0
    );
    return parts.length > 0 ? parts.join(' → ') : 'No description yet';
  };

  // For historical dates, the "now" reference point is the end of that day.
  // This keeps date labels, range calculations, and run filtering correct.
  const now = useMemo(() => {
    if (reportDate) {
      const [y, mo, d] = reportDate.split('-').map(Number);
      return new Date(y, mo - 1, d, 23, 59, 59, 999);
    }
    return new Date();
  }, [reportDate]);

  const dateLong = now.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const dateShort = now.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  // Total tracked time across all active panels (work only — breaks are
  // excluded so "tracked" stays meaningful, matching the Home header).
  const totalTrackedMs = activePanelIds.reduce(
    (sum, id) => sum + getPanelMs(id),
    0,
  );

  const panels: PanelData[] = useMemo(() => {
    return livePanels.map(p => {
      const e = edits[p.id] ?? defaultEdits();
      return {
        id: p.id,
        name: p.name,
        color: p.barClass,
        subtitle: subtitleFor(p),
        time: formatHM(getPanelMs(p.id)),
        included: e.included,
        outcome: e.outcome,
        followUp: e.followUp,
        blocker: e.blocker,
        unrealizedEffort: e.unrealizedEffort,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePanels, edits, panelAccum, activeTimer]);

  const [sources, setSources] = useState<SourceData[]>([
    {
      id: 'taskpanels', label: 'TaskPanels Activity', labelShort: 'TaskPanels', badge: `${activePanelIds.length} ${activePanelIds.length === 1 ? 'panel' : 'panels'}`, on: true,
      colorBg: 'bg-blue-50', colorBorder: 'border-blue-200', colorText: 'text-blue-700',
      colorBadgeBg: 'bg-blue-100', colorBadgeText: 'text-blue-400', colorCheck: 'text-blue-400',
      icon: <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
    },
    {
      id: 'claude', label: 'Claude Work Digest', labelShort: 'Claude', badge: '3 sessions', on: false,
      colorBg: 'bg-orange-50', colorBorder: 'border-orange-200', colorText: 'text-orange-700',
      colorBadgeBg: 'bg-orange-100', colorBadgeText: 'text-orange-400', colorCheck: 'text-orange-400',
      icon: <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    },
    {
      id: 'browser', label: 'Browser AI Activity', labelShort: 'Browser AI', badge: '12 items', on: false,
      colorBg: 'bg-slate-50', colorBorder: 'border-slate-200', colorText: 'text-slate-400',
      colorBadgeBg: 'bg-slate-100', colorBadgeText: 'text-slate-300', colorCheck: 'text-slate-400',
      icon: <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>,
    },
  ]);

  // ---- Computed ----
  const remainingCount = useMemo(() => panels.filter(p => p.outcome === null).length, [panels]);

  // Keep the TaskPanels source badge in sync with the live panel count.
  useEffect(() => {
    const label = `${activePanelIds.length} ${activePanelIds.length === 1 ? 'panel' : 'panels'}`;
    setSources(prev => prev.map(s => s.id === 'taskpanels' && s.badge !== label ? { ...s, badge: label } : s));
  }, [activePanelIds]);

  // ---- Handlers ----

  function toggleSource(id: string) {
    setSources(prev => prev.map(s => s.id === id ? { ...s, on: !s.on } : s));
  }

  const patchEdit = (panelId: string, patch: Partial<PanelEdits>) => {
    setEdits(prev => {
      const cur = prev[panelId] ?? defaultEdits();
      return { ...prev, [panelId]: { ...cur, ...patch } };
    });
  };

  function setOutcome(panelId: string, outcome: PanelOutcome) {
    const cur = edits[panelId] ?? defaultEdits();
    patchEdit(panelId, { outcome: cur.outcome === outcome ? null : outcome });
  }

  function toggleIncluded(panelId: string) {
    const cur = edits[panelId] ?? defaultEdits();
    patchEdit(panelId, { included: !cur.included });
  }

  function updateFollowUp(panelId: string, field: keyof FollowUpDetails, value: string) {
    const cur = edits[panelId] ?? defaultEdits();
    patchEdit(panelId, { followUp: { ...cur.followUp, [field]: value } });
  }

  function updateBlocker(panelId: string, value: string) {
    patchEdit(panelId, { blocker: value });
  }

  function setUnrealizedEffort(panelId: string, value: boolean) {
    patchEdit(panelId, { unrealizedEffort: value });
  }

  // ---- Shared sub-components ----

  const BackIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
  );

  const CalendarIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );

  const BoltIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  );

  const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" /></svg>
  );

  // Bundle the card handlers once so we can spread them into the cards.
  const cardHandlers: PanelCardHandlers = {
    toggleIncluded, setOutcome, updateFollowUp, updateBlocker, setUnrealizedEffort,
  };

  // ---- Generate: snapshot + navigate ----
  //
  // Build the normalized SummaryInput the moment the user taps "Generate
  // Summary". Snapshot semantics: subsequent edits on this screen don't
  // silently mutate an already-rendered Daily Summary / Performance Review.
  // The snapshot lives on NavContext so both report screens can read it
  // without prop-drilling, and future AI calls can POST this exact payload.
  const generate = () => {
    // Catalog snapshot derived from live Panel instances.
    const panelSnapshot = livePanels.map(p => ({
      id: p.id,
      name: p.name,
      barClass: p.barClass,
      colorHex: hexFor(p.color),
    }));

    // buildSummaryInput still takes a per-panel "drafts" map — synthesize
    // one from the instance fields so we don't have to fork summaryModel.
    // `kind` and the meeting-specific fields are threaded through so
    // meetings land as a first-class reporting dimension downstream.
    const panelDraftsFromInstances: Record<
      string,
      {
        focusNote?: string;
        notes?: string;
        workType?: string;
        project?: string;
        tags?: string[];
        sessionState?: string;
        kind?: PanelKind;
        meetingType?: MeetingType;
        audience?: MeetingAudience;
        topic?: string;
      }
    > = {};
    for (const p of livePanels) {
      panelDraftsFromInstances[p.id] = {
        focusNote: p.focusNote,
        notes: p.notes,
        workType: p.workType,
        project: p.project,
        tags: p.tags,
        sessionState: p.sessionState,
        kind: p.kind,
        meetingType: p.meetingType,
        audience: p.audience,
        topic: p.topic,
      };
    }

    // The report window. isDaily → today (label = full weekday date);
    // otherwise → the resolved preset/custom range.
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const dateRange = isDaily
      ? { start: todayStart, end: todayEnd, label: dateLong }
      : { start: resolvedRange.start, end: resolvedRange.end, label: rangeLabel };

    // External digests — only surface the ones whose source card is toggled on.
    // Today these are placeholder summaries; when the ingestion pipeline is
    // real these will carry structured digests from Claude / the browser ext.
    const claudeSource = sources.find(s => s.id === 'claude');
    const browserSource = sources.find(s => s.id === 'browser');
    const externalDigests: { claude?: ExternalDigest; browser?: ExternalDigest } = {};
    if (claudeSource && claudeSource.on) {
      externalDigests.claude = {
        kind: 'claude',
        label: claudeSource.label,
        summary: claudeSource.badge,
      };
    }
    if (browserSource && browserSource.on) {
      externalDigests.browser = {
        kind: 'browser',
        label: browserSource.label,
        summary: browserSource.badge,
      };
    }

    const includedSourceIds: SourceId[] = sources
      .filter(s => s.on)
      .map(s => s.id as SourceId)
      .filter(id => id === 'taskpanels' || id === 'claude' || id === 'browser');

    // Snapshot runs for the timeline. Close any still-open run at
    // `now` so the in-flight session shows up on the report instead
    // of vanishing into accum-only. The underlying runs[] state is
    // untouched — this is a frozen view for summary generation, and
    // the summary model requires all runs to have a concrete endedAt.
    const runsSnapshot: RunSegment[] = runs.map(r => ({
      id: r.id,
      panelId: r.panelId,
      startedAt: r.startedAt,
      endedAt: r.endedAt ?? now.getTime(),
    }));

    const input = buildSummaryInput({
      reportKind: (isDaily ? 'daily' : 'performance') as ReportKind,
      audience: audience as SummaryAudience,
      style: summaryStyle as SummaryStyleKind,
      dateRange,
      activePanelIds,
      panelCatalog: panelSnapshot,
      panelAccum,
      panelDrafts: panelDraftsFromInstances,
      panelEdits: edits,
      breakAccum,
      runs: runsSnapshot,
      overtimeThresholdMs: preferences.overtimeThresholdHours * 60 * 60 * 1000,
      includedSourceIds,
      externalDigests,
      mode: 'deterministic',
    });

    setCurrentSummary(input);
    // Persist daily reports into the per-date archive so the user
    // can revisit the narrative, outcomes, blockers, and follow-ups
    // from SummaryArchive long after this session ends. saveSummary
    // is a no-op for non-daily kinds, so calling it unconditionally
    // is safe here.
    saveSummary(input);
    // Clear the pending historical date — this generate() call consumed it.
    setPendingReportDate(null);
    navigate(isDaily ? 'daily-summary' : 'performance-review');
  };


  // ========================================================
  // RENDER
  // ========================================================

  return (
    <>
      {/* ==========================================
           DESKTOP LAYOUT
           ========================================== */}
      <div className="hidden md:flex flex-col h-full overflow-hidden bg-white">
        {/* Header */}
        <header className="px-8 py-5 border-b border-slate-100 flex items-center gap-4 shrink-0">
          <button onClick={goHome} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors shrink-0" title="Back to Home">
            <BackIcon />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">Prepare Summary</h1>
            <p className="text-sm text-slate-400">{dateLong}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Today</span>
              <div className="text-lg font-mono font-bold text-slate-900 tabular-nums">{formatHM(totalTrackedMs)}</div>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto hide-scrollbar">
          <div className="max-w-3xl mx-auto px-8 py-8 space-y-8">

            {/* ═══ Report Range ═══
                One unified picker replaces the old Report Type toggle +
                conditional Date Range section. Today = daily summary;
                any other preset / custom range = performance review. */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Report Range</h2>
                <span className="text-xs text-slate-500 tabular-nums">{isDaily ? dateLong : rangeLabel}</span>
              </div>

              {/* Today — the hero card. Larger, icon on a filled tile,
                  shows the tracked time inline so the user can see
                  there's something to report on without guessing. */}
              <button
                type="button"
                onClick={() => setRangePreset('today')}
                className={`w-full rounded-2xl border-2 p-4 text-left transition-colors ${
                  isDaily
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    isDaily ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-base font-bold ${isDaily ? 'text-blue-700' : 'text-slate-900'}`}>Today</p>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isDaily ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>Daily Summary</span>
                    </div>
                    <p className={`text-xs mt-0.5 ${isDaily ? 'text-blue-600' : 'text-slate-500'}`}>
                      {dateLong} · <span className="font-mono tabular-nums">{formatHM(totalTrackedMs)}</span> tracked
                    </p>
                  </div>
                  {isDaily && <CheckIcon className="w-5 h-5 text-blue-600 shrink-0" />}
                </div>
              </button>

              {/* Divider — "Or a past range" */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Or a past range · Performance Review</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Past-range chips + Custom trigger */}
              <div className="flex flex-wrap gap-1.5">
                {PAST_RANGE_PRESETS.map(p => {
                  const selected = rangePreset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setRangePreset(p.id)}
                      className={`px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        selected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setRangePreset('custom')}
                  className={`px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                    rangePreset === 'custom'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  Custom…
                </button>
              </div>

              {/* Custom date inputs, only when custom is selected */}
              {rangePreset === 'custom' && (
                <div className="mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">From</span>
                      <input
                        type="date"
                        value={toISODateLocal(customStart)}
                        max={toISODateLocal(customEnd)}
                        onChange={e => setCustomStart(fromISODateLocal(e.target.value))}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-slate-400"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">To</span>
                      <input
                        type="date"
                        value={toISODateLocal(customEnd)}
                        min={toISODateLocal(customStart)}
                        max={toISODateLocal(new Date())}
                        onChange={e => setCustomEnd(fromISODateLocal(e.target.value))}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-slate-400"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* ═══ Included Sources ═══ */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Included Sources</h2>
              <div className="flex flex-wrap gap-2">
                {sources.map(src => (
                  <button
                    key={src.id}
                    onClick={() => toggleSource(src.id)}
                    className={`source-toggle ${src.on ? 'on' : 'off'} flex items-center gap-2 px-3.5 py-2 rounded-xl border cursor-pointer ${
                      src.on ? `${src.colorBg} ${src.colorBorder}` : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {src.icon}
                    <span className={`text-sm font-medium ${src.on ? src.colorText : 'text-slate-400'}`}>{src.label}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      src.on ? `${src.colorBadgeText} ${src.colorBadgeBg}` : 'text-slate-300 bg-slate-100'
                    }`}>{src.badge}</span>
                    {src.on && <CheckIcon className={`w-4 h-4 ${src.colorCheck} shrink-0 ml-1`} />}
                  </button>
                ))}
              </div>
            </div>

            {/* ═══ Complete Outcomes ═══ */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Complete Outcomes</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Classify how each workstream ended today</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                  remainingCount > 2
                    ? 'text-amber-600 bg-amber-50'
                    : 'text-emerald-600 bg-emerald-50'
                }`}>
                  {remainingCount} remaining
                </span>
              </div>

              <div className="space-y-3">
                {panels.map(panel => (
                  <DesktopPanelCard key={panel.id} panel={panel} {...cardHandlers} />
                ))}
              </div>
            </div>

            {/* ═══ Audience & Style (side by side) ═══ */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Report Audience</h2>
                <div className="flex flex-wrap gap-2">
                  {(['manager', 'team', 'client', 'personal'] as Audience[]).map(a => (
                    <button
                      key={a}
                      onClick={() => setAudience(a)}
                      className={`choice-chip px-4 py-2.5 rounded-xl border text-sm font-medium ${
                        audience === a ? 'selected' : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      {a === 'team' ? 'Team / Internal' : a === 'personal' ? 'Personal Log' : a.charAt(0).toUpperCase() + a.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Summary Style</h2>
                <div className="flex flex-wrap gap-2">
                  {(['concise', 'standard', 'detailed'] as SummaryStyle[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setSummaryStyle(s)}
                      className={`choice-chip px-4 py-2.5 rounded-xl border text-sm font-medium ${
                        summaryStyle === s ? 'selected' : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ═══ Generate Actions ═══ */}
            <div className="flex items-center gap-3 pt-2 pb-4">
              <button onClick={generate} className="flex-1 h-14 bg-slate-900 text-white font-semibold rounded-2xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2.5 text-base">
                <BoltIcon className="w-5 h-5" />
                Generate Report
              </button>
              <button onClick={goHome} className="h-14 px-6 border border-slate-200 bg-white text-slate-600 font-semibold rounded-2xl hover:bg-slate-50 transition-colors text-base">
                Cancel
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ==========================================
           MOBILE LAYOUT
           ========================================== */}
      <div className="md:hidden flex flex-col h-full overflow-hidden bg-white">

        {/* Mobile Header */}
        <header className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
          <button onClick={goHome} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 shrink-0" title="Back to Home">
            <BackIcon />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900">Prepare Summary</h1>
            <p className="text-[11px] text-slate-400">{dateShort}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">{formatHM(totalTrackedMs)}</span>
            <p className="text-[9px] text-slate-400 uppercase tracking-wider">tracked</p>
          </div>
        </header>

        {/* Mobile Scrollable Content */}
        <div className="flex-1 overflow-auto hide-scrollbar px-4 py-5 space-y-5">

          {/* Report Range — unified picker (mobile) */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Report Range</h2>
              <span className="text-[10px] text-slate-500 tabular-nums">{isDaily ? dateShort : rangeLabel}</span>
            </div>

            {/* Today — featured card */}
            <button
              type="button"
              onClick={() => setRangePreset('today')}
              className={`w-full rounded-xl border-2 p-3 text-left transition-colors ${
                isDaily
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isDaily ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-sm font-bold ${isDaily ? 'text-blue-700' : 'text-slate-900'}`}>Today</p>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      isDaily ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>Daily</span>
                  </div>
                  <p className={`text-[11px] ${isDaily ? 'text-blue-600' : 'text-slate-500'}`}>
                    {dateShort} · <span className="font-mono tabular-nums">{formatHM(totalTrackedMs)}</span> tracked
                  </p>
                </div>
                {isDaily && <CheckIcon className="w-4 h-4 text-blue-600 shrink-0" />}
              </div>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Or past range</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Past-range chips + Custom */}
            <div className="flex flex-wrap gap-1">
              {PAST_RANGE_PRESETS.map(p => {
                const selected = rangePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setRangePreset(p.id)}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium ${
                      selected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    {p.labelShort}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setRangePreset('custom')}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1 ${
                  rangePreset === 'custom'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                <CalendarIcon className="w-3 h-3" />
                Custom
              </button>
            </div>

            {/* Custom date inputs (mobile) */}
            {rangePreset === 'custom' && (
              <div className="mt-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">From</span>
                    <input
                      type="date"
                      value={toISODateLocal(customStart)}
                      max={toISODateLocal(customEnd)}
                      onChange={e => setCustomStart(fromISODateLocal(e.target.value))}
                      className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-md text-[11px] text-slate-700 outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">To</span>
                    <input
                      type="date"
                      value={toISODateLocal(customEnd)}
                      min={toISODateLocal(customStart)}
                      max={toISODateLocal(new Date())}
                      onChange={e => setCustomEnd(fromISODateLocal(e.target.value))}
                      className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-md text-[11px] text-slate-700 outline-none"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Included Sources */}
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Included Sources</h2>
            <div className="flex flex-wrap gap-1.5">
              {sources.map(src => (
                <button
                  key={src.id}
                  onClick={() => toggleSource(src.id)}
                  className={`source-toggle ${src.on ? 'on' : 'off'} flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                    src.on ? `${src.colorBg} ${src.colorBorder}` : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {React.cloneElement(
                    src.icon as React.ReactElement<{ className?: string }>,
                    { className: `w-3.5 h-3.5 ${src.on ? '' : 'text-slate-400'} shrink-0` },
                  )}
                  <span className={`text-xs font-medium ${src.on ? src.colorText : 'text-slate-400'}`}>{src.labelShort}</span>
                  {src.on && <CheckIcon className={`w-3 h-3 ${src.colorCheck} shrink-0`} />}
                </button>
              ))}
            </div>
          </div>

          {/* Complete Outcomes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Complete Outcomes</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Classify each workstream</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                remainingCount > 2
                  ? 'text-amber-600 bg-amber-50'
                  : 'text-emerald-600 bg-emerald-50'
              }`}>
                {remainingCount} left
              </span>
            </div>

            <div className="space-y-2.5">
              {panels.map(panel => (
                <MobilePanelCard key={panel.id} panel={panel} {...cardHandlers} />
              ))}
            </div>
          </div>

          {/* Audience */}
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Report Audience</h2>
            <div className="flex flex-wrap gap-1.5">
              {(['manager', 'team', 'client', 'personal'] as Audience[]).map(a => (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  className={`choice-chip px-3 py-2 rounded-xl border text-xs font-medium ${
                    audience === a ? 'selected' : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  {a === 'team' ? 'Team' : a === 'personal' ? 'Personal' : a.charAt(0).toUpperCase() + a.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Summary Style</h2>
            <div className="flex gap-1.5">
              {(['concise', 'standard', 'detailed'] as SummaryStyle[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSummaryStyle(s)}
                  className={`choice-chip px-3 py-2 rounded-xl border text-xs font-medium ${
                    summaryStyle === s ? 'selected' : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="h-2" />
        </div>

        {/* Fixed bottom action bar */}
        <div className="px-4 pt-3 border-t border-slate-100 bg-white shrink-0 flex gap-2.5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
          <button onClick={generate} className="flex-1 h-12 bg-slate-900 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 text-sm">
            <BoltIcon className="w-4 h-4" />
            Generate Report
          </button>
          <button onClick={goHome} className="h-12 px-5 border border-slate-200 bg-white text-slate-600 font-semibold rounded-2xl text-sm">
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};

export default PrepareSummaryScreen;
