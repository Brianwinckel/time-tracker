// ============================================================
// Daily Work Summary
// ------------------------------------------------------------
// Reads the snapshot the user generated on Prepare Summary
// (nav.currentSummary) and renders it via generateDailySummary.
//
// Sections that have no backing data yet are hidden, per the
// roadmap principle "capture the truth, then shape it":
//   - Productivity Flow (requires per-minute intensity signals)
//   - "Focus Score" / "Best Streak" (invented metrics)
// The Scorecard now surfaces the generator's KPIs instead.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useNav } from '../../lib/previewNav';
import {
  formatHM,
  generateDailySummary,
  type DailySummaryData,
  type LegendEntry,
  type OvertimeInfo,
  type ProjectBreakdown,
  type TimelineEntry,
  type KPI,
} from '../../lib/summaryModel';
import { toPlainText, buildMailtoUrl } from '../../lib/summaryExport';

const Logo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <circle cx="8" cy="8" r="5" fill="#3b82f6" />
    <circle cx="20" cy="8" r="5" fill="#10b981" />
    <circle cx="8" cy="20" r="5" fill="#f97316" />
    <circle cx="20" cy="20" r="5" fill="#8b5cf6" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const EmailIcon = () => (
  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 4l-10 8L2 4" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// Swapped in for the Copy icon for ~2s after the user taps Copy,
// so they get a visible confirmation that the clipboard write landed.
const CheckIconSmall = () => (
  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

// Spinner used on the Download button while the PDF is being
// generated — the jspdf import + drawing can take a beat on
// mobile, so we don't want the user double-tapping.
const SpinnerIcon = () => (
  <svg className="w-4 h-4 text-slate-500 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} strokeOpacity={0.25} />
    <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
  </svg>
);

const ClockIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const LightningIcon = ({ className = 'w-4 h-4 text-white' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

// ---- Donut chart built from real allocation ----
//
// The generator gives us legend entries already sorted by percentage and
// already carrying a colorHex. We just need to walk them and emit one arc
// per slice, tracking the running stroke-dashoffset.
const DonutChart: React.FC<{ size?: number; legend: LegendEntry[] }> = ({ size = 100, legend }) => {
  const circumference = 2 * Math.PI * 38; // r=38
  let running = 0;
  const nonZero = legend.filter(l => l.pct > 0);
  if (nonZero.length === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth={12} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth={12} />
      {nonZero.map(slice => {
        const len = (slice.pct / 100) * circumference;
        const arc = (
          <circle
            key={slice.panelId}
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke={slice.colorHex}
            strokeWidth={12}
            strokeDasharray={`${len} ${circumference - len}`}
            strokeDashoffset={-running}
            transform="rotate(-90 50 50)"
            strokeLinecap="butt"
          />
        );
        running += len;
        return arc;
      })}
    </svg>
  );
};

// ---- AI Summary block (renders generator narrative paragraphs) ----

const AISummaryDesktop: React.FC<{ narrative: string[] }> = ({ narrative }) => (
  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
        <LightningIcon className="w-4 h-4 text-white" />
      </div>
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Summary</h2>
    </div>
    <div className="space-y-2">
      {narrative.map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-slate-300">{p}</p>
      ))}
    </div>
  </div>
);

const AISummaryMobile: React.FC<{ narrative: string[] }> = ({ narrative }) => (
  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white">
    <div className="flex items-center gap-2 mb-2">
      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
        <LightningIcon className="w-3.5 h-3.5 text-white" />
      </div>
      <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Summary</h2>
    </div>
    <div className="space-y-1.5">
      {narrative.map((p, i) => (
        <p key={i} className="text-xs leading-relaxed text-slate-300">{p}</p>
      ))}
    </div>
  </div>
);

// ---- Scorecard: the generator's KPIs, 4 tiles ----

const KPI_TILE_STYLES = [
  { wrap: 'from-blue-50 to-blue-100',       value: 'text-blue-600',    label: 'text-blue-400' },
  { wrap: 'from-emerald-50 to-emerald-100', value: 'text-emerald-600', label: 'text-emerald-400' },
  { wrap: 'from-purple-50 to-purple-100',   value: 'text-purple-600',  label: 'text-purple-400' },
  { wrap: 'from-orange-50 to-orange-100',   value: 'text-orange-500',  label: 'text-orange-400' },
];

const ScorecardDesktop: React.FC<{ kpis: KPI[] }> = ({ kpis }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6">
    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Scorecard</h3>
    <div className="grid grid-cols-2 gap-3">
      {kpis.map((kpi, i) => {
        const style = KPI_TILE_STYLES[i % KPI_TILE_STYLES.length];
        return (
          <div key={kpi.label} className={`bg-gradient-to-br ${style.wrap} rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-extrabold ${style.value}`}>{kpi.value}</p>
            <p className={`text-[10px] font-semibold ${style.label} uppercase tracking-wider mt-1`}>{kpi.label}</p>
            {kpi.sub && <p className="text-[9px] text-slate-400 mt-0.5">{kpi.sub}</p>}
          </div>
        );
      })}
    </div>
  </div>
);

const ScorecardMobile: React.FC<{ kpis: KPI[] }> = ({ kpis }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5">
    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Scorecard</h3>
    <div className="grid grid-cols-2 gap-2.5">
      {kpis.map((kpi, i) => {
        const style = KPI_TILE_STYLES[i % KPI_TILE_STYLES.length];
        return (
          <div key={kpi.label} className={`bg-gradient-to-br ${style.wrap} rounded-xl p-3 text-center`}>
            <p className={`text-xl font-extrabold ${style.value}`}>{kpi.value}</p>
            <p className={`text-[9px] font-semibold ${style.label} uppercase tracking-wider mt-1`}>{kpi.label}</p>
            {kpi.sub && <p className="text-[9px] text-slate-400 mt-0.5">{kpi.sub}</p>}
          </div>
        );
      })}
    </div>
  </div>
);

// ---- Timeline: real time-of-day axis from runs ----
//
// Image-one layout: a vertical rail on the left rendered with time labels
// + dots, with a tinted card per row. Breaks render with a clock icon and
// an amber tint instead of the panel accent. Work rows pull a light tint
// derived from their barClass (e.g. bg-blue-500 → bg-blue-50/60).

const ClockTimelineIcon = () => (
  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);

/** Map a Tailwind bar class (e.g. "bg-blue-500") to a row tint pair
 *  (light background + matching border) used by the timeline cards.
 *  Listed exhaustively so Tailwind's JIT picks up every class. */
const TIMELINE_TINT_BY_BAR: Record<string, { bg: string; border: string }> = {
  'bg-blue-500':    { bg: 'bg-blue-50/70',    border: 'border-blue-100' },
  'bg-emerald-500': { bg: 'bg-emerald-50/70', border: 'border-emerald-100' },
  'bg-orange-400':  { bg: 'bg-orange-50/70',  border: 'border-orange-100' },
  'bg-orange-500':  { bg: 'bg-orange-50/70',  border: 'border-orange-100' },
  'bg-purple-500':  { bg: 'bg-purple-50/70',  border: 'border-purple-100' },
  'bg-rose-500':    { bg: 'bg-rose-50/70',    border: 'border-rose-100' },
  'bg-amber-500':   { bg: 'bg-amber-50/70',   border: 'border-amber-100' },
  'bg-amber-300':   { bg: 'bg-amber-50/80',   border: 'border-amber-200' },
  'bg-teal-500':    { bg: 'bg-teal-50/70',    border: 'border-teal-100' },
  'bg-slate-500':   { bg: 'bg-slate-50',      border: 'border-slate-200' },
  'bg-slate-400':   { bg: 'bg-slate-50',      border: 'border-slate-200' },
};

const tintFor = (barClass: string): { bg: string; border: string } =>
  TIMELINE_TINT_BY_BAR[barClass] ?? { bg: 'bg-slate-50', border: 'border-slate-200' };

interface TimelineRowProps {
  entry: TimelineEntry;
  /** Width of the left time-label column. Desktop is wider than mobile. */
  timeColClass: string;
  /** Vertical position of the dot relative to the row top. */
  dotOffset: 'top-3' | 'top-2.5';
}

const TimelineRow: React.FC<TimelineRowProps> = ({ entry, timeColClass, dotOffset }) => {
  const isPause = entry.kind !== 'work';
  const tint = isPause
    ? { bg: 'bg-amber-50/80', border: 'border-amber-200' }
    : tintFor(entry.barClass);
  return (
    <div className="flex items-start gap-3">
      {/* Left rail: time label */}
      <div className={`${timeColClass} pt-2.5 text-right shrink-0`}>
        <span className="text-xs font-semibold text-slate-400 tabular-nums">{entry.startLabel}</span>
      </div>

      {/* Dot column — anchored to the absolute rail line drawn by the parent */}
      <div className="relative w-3 shrink-0 self-stretch">
        <span
          className={`absolute left-1/2 -translate-x-1/2 ${dotOffset} block w-3 h-3 rounded-full ring-4 ring-white z-10`}
          style={{ backgroundColor: entry.colorHex }}
        />
      </div>

      {/* Tinted card */}
      <div className={`flex-1 ${tint.bg} ${tint.border} border rounded-xl pl-3 pr-4 py-2.5 flex items-stretch gap-3 min-w-0`}>
        {/* Vertical accent stripe (matches panel color) */}
        <div className="w-1 rounded-full self-stretch shrink-0" style={{ backgroundColor: entry.colorHex }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {isPause && <ClockTimelineIcon />}
            <span className={`text-sm font-bold truncate ${isPause ? 'text-amber-900' : 'text-slate-800'}`}>
              {entry.name}
            </span>
            {entry.isMeeting && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 rounded px-1.5 py-0.5 shrink-0">
                MTG
              </span>
            )}
            <span className="text-xs font-mono text-slate-500 ml-auto shrink-0 tabular-nums">
              {entry.duration}
            </span>
          </div>
          {entry.description && (
            <p className={`text-xs mt-0.5 truncate ${isPause ? 'text-amber-700/80' : 'text-slate-500'}`}>
              {entry.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const TimelineEmpty: React.FC = () => (
  <p className="text-xs text-slate-400">No tracked runs in this window yet — the timeline will fill in once you start a panel.</p>
);

const DesktopTimeline: React.FC<{ timeline: TimelineEntry[] }> = ({ timeline }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6">
    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5">Timeline</h3>
    {timeline.length === 0 ? (
      <TimelineEmpty />
    ) : (
      <div className="relative">
        {/* Vertical rail. Positioned so the dots in TimelineRow center on it.
            Time col = 14 (w-14, 56px) + gap-3 (12px) + half of dot col (w-3 → 6px) = 74px. */}
        <div className="absolute top-2 bottom-2 left-[74px] w-px bg-slate-200" />
        <div className="space-y-3">
          {timeline.map(t => (
            <TimelineRow key={t.id} entry={t} timeColClass="w-14" dotOffset="top-3" />
          ))}
        </div>
      </div>
    )}
  </div>
);

const MobileTimeline: React.FC<{ timeline: TimelineEntry[] }> = ({ timeline }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4">
    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Timeline</h3>
    {timeline.length === 0 ? (
      <TimelineEmpty />
    ) : (
      <div className="relative">
        {/* time col w-12 (48px) + gap-3 (12px) + half of dot col (6px) = 66px */}
        <div className="absolute top-2 bottom-2 left-[66px] w-px bg-slate-200" />
        <div className="space-y-2.5">
          {timeline.map(t => (
            <TimelineRow key={t.id} entry={t} timeColClass="w-12" dotOffset="top-2.5" />
          ))}
        </div>
      </div>
    )}
  </div>
);

// ---- Overtime banner ----
//
// Only renders when the user crossed the threshold. Lives just above
// the main column so it's the first thing the user sees on report load.

const OvertimeBanner: React.FC<{ overtime: OvertimeInfo; compact?: boolean }> = ({ overtime, compact }) => {
  if (!overtime.isOver) return null;
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className={`shrink-0 rounded-xl bg-amber-200/60 flex items-center justify-center ${compact ? 'w-9 h-9' : 'w-11 h-11'}`}>
        <svg className={`text-amber-700 ${compact ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-amber-900 ${compact ? 'text-xs' : 'text-sm'}`}>
          Overtime: {overtime.overLabel} past your {overtime.thresholdLabel} day
        </p>
        <p className={`text-amber-800/80 ${compact ? 'text-[11px]' : 'text-xs'} truncate`}>
          You worked {overtime.workedLabel} today.
        </p>
      </div>
    </div>
  );
};

// ---- Day composition (donut + legend) ----

const DayCompositionDesktop: React.FC<{ legend: LegendEntry[] }> = ({ legend }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6">
    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Day Composition</h3>
    <div className="flex items-center gap-6">
      <DonutChart size={100} legend={legend} />
      <div className="flex-1 space-y-1.5">
        {legend.length === 0 && <p className="text-xs text-slate-400">No tracked time.</p>}
        {legend.map(item => (
          <div key={item.panelId} className="flex items-center">
            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.colorHex }} />
            <span className="text-xs text-slate-600 ml-2">{item.name}</span>
            <span className="text-xs font-semibold text-slate-800 ml-auto pl-4">{item.time}</span>
            <span className="text-[10px] text-slate-400 ml-2 tabular-nums">{item.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const DayCompositionMobile: React.FC<{ legend: LegendEntry[] }> = ({ legend }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4">
    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Day Composition</h3>
    <div className="flex items-center gap-4">
      <DonutChart size={80} legend={legend} />
      <div className="flex-1 space-y-1.5">
        {legend.length === 0 && <p className="text-xs text-slate-400">No tracked time.</p>}
        {legend.map(item => (
          <div key={item.panelId} className="flex items-center">
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.colorHex }} />
            <span className="text-xs text-slate-600 ml-2 truncate">{item.shortName}</span>
            <span className="text-xs font-semibold text-slate-800 ml-auto pl-3">{item.time}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ---- By Project: time + outcomes per Project (the major reporting dim) ----
//
// Projects are a first-class workflow object — every report surfaces them
// here so the user can see "where did the time go, by client/initiative."
// Each row shows total time, the focus/meeting split, outcome counts, and
// (when present) the workstreams that contributed to it. The 'Unassigned'
// bucket is rendered last and visually muted so it reads as a gap to fill.

const OutcomePill: React.FC<{ count: number; label: string; tone: 'emerald' | 'orange' | 'purple' | 'slate' }> = ({
  count,
  label,
  tone,
}) => {
  if (count === 0) return null;
  const toneClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    orange: 'bg-orange-50 text-orange-700',
    purple: 'bg-purple-50 text-purple-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${toneClasses[tone]}`}
    >
      <span className="tabular-nums">{count}</span>
      <span className="opacity-70">{label}</span>
    </span>
  );
};

const ByProjectDesktop: React.FC<{ byProject: ProjectBreakdown[] }> = ({ byProject }) => {
  if (byProject.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">By Project</h3>
        <span className="text-[10px] text-slate-400">{byProject.length} projects</span>
      </div>
      <div className="space-y-3">
        {byProject.map(p => (
          <div
            key={p.projectName}
            className={`rounded-xl border p-4 ${
              p.isUnassigned ? 'bg-slate-50 border-dashed border-slate-200' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2.5 h-2.5 rounded-full ${p.barClass} shrink-0`} />
              <span
                className={`text-sm font-semibold ${
                  p.isUnassigned ? 'text-slate-500 italic' : 'text-slate-800'
                }`}
              >
                {p.projectName}
              </span>
              <span className="text-xs text-slate-400 ml-1 tabular-nums">{p.pct}%</span>
              <span className="text-xs font-mono text-slate-700 ml-auto tabular-nums">{formatHM(p.totalMs)}</span>
            </div>
            {/* Bar */}
            <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden mb-2">
              <div className={`h-full ${p.barClass}`} style={{ width: `${Math.max(2, p.pct)}%` }} />
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] text-slate-500">
                {formatHM(p.focusMs)} focus
                {p.meetingMs > 0 && ` · ${formatHM(p.meetingMs)} meetings`}
                {' · '}
                {p.workstreamCount} {p.workstreamCount === 1 ? 'workstream' : 'workstreams'}
              </p>
              <div className="flex items-center gap-1.5">
                <OutcomePill count={p.completedCount} label="done" tone="emerald" />
                <OutcomePill count={p.followUpCount} label="follow-up" tone="purple" />
                <OutcomePill count={p.blockedCount} label="blocked" tone="orange" />
                <OutcomePill count={p.unrealizedEffortCount} label="unrealized" tone="slate" />
              </div>
            </div>
            {p.workstreamNames.length > 0 && (
              <p className="text-[11px] text-slate-400 mt-2 truncate">{p.workstreamNames.join(' · ')}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ByProjectMobile: React.FC<{ byProject: ProjectBreakdown[] }> = ({ byProject }) => {
  if (byProject.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">By Project</h3>
        <span className="text-[10px] text-slate-400">{byProject.length}</span>
      </div>
      <div className="space-y-2.5">
        {byProject.map(p => (
          <div
            key={p.projectName}
            className={`rounded-lg p-3 border ${
              p.isUnassigned ? 'bg-slate-50 border-dashed border-slate-200' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-2 h-2 rounded-full ${p.barClass} shrink-0`} />
              <span
                className={`text-xs font-semibold truncate ${
                  p.isUnassigned ? 'text-slate-500 italic' : 'text-slate-800'
                }`}
              >
                {p.projectName}
              </span>
              <span className="text-[10px] text-slate-400 ml-0.5 tabular-nums">{p.pct}%</span>
              <span className="text-[11px] font-mono text-slate-700 ml-auto tabular-nums">{formatHM(p.totalMs)}</span>
            </div>
            <div className="h-1 rounded-full bg-slate-200 overflow-hidden mb-1.5">
              <div className={`h-full ${p.barClass}`} style={{ width: `${Math.max(2, p.pct)}%` }} />
            </div>
            <div className="flex items-center justify-between gap-1.5">
              <p className="text-[10px] text-slate-500 truncate">
                {p.workstreamCount} {p.workstreamCount === 1 ? 'stream' : 'streams'}
                {p.meetingMs > 0 && ` · ${formatHM(p.meetingMs)} mtg`}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                <OutcomePill count={p.completedCount} label="done" tone="emerald" />
                <OutcomePill count={p.blockedCount} label="blk" tone="orange" />
                <OutcomePill count={p.followUpCount} label="f/u" tone="purple" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- Classification lists (completed / follow-ups / blockers) ----

const Classification: React.FC<{ data: DailySummaryData }> = ({ data }) => {
  const blocks: { title: string; color: string; items: string[] }[] = [];
  if (data.completed.length > 0)
    blocks.push({ title: 'Completed', color: 'emerald', items: data.completed });
  if (data.followUps.length > 0)
    blocks.push({ title: 'Follow-up', color: 'purple', items: data.followUps });
  if (data.blockers.length > 0)
    blocks.push({ title: 'Blockers', color: 'orange', items: data.blockers });

  if (blocks.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outcomes</h3>
      {blocks.map(b => (
        <div key={b.title}>
          <p className={`text-[11px] font-semibold uppercase tracking-wider text-${b.color}-600 mb-1.5`}>{b.title}</p>
          <ul className="space-y-1">
            {b.items.map((s, i) => (
              <li key={i} className="text-xs text-slate-600 flex gap-2">
                <span className={`inline-block w-1 rounded-full bg-${b.color}-400 mt-1.5 h-1 shrink-0`} />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

// Tab bar icons
const TrackerIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const SummaryIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const TeamIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const MoreIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

// ---- Empty state when user landed here without generating a snapshot ----
const EmptyState: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
    <div className="max-w-sm text-center space-y-3">
      <div className="inline-flex w-14 h-14 rounded-2xl bg-slate-200 items-center justify-center">
        <ClockIcon className="w-7 h-7 text-slate-400" />
      </div>
      <h2 className="text-base font-bold text-slate-900">No summary generated yet</h2>
      <p className="text-sm text-slate-500">
        Open Prepare Summary, choose <em>Daily Summary</em>, then tap Generate Summary to build this view.
      </p>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold"
      >
        Go to Prepare Summary
      </button>
    </div>
  </div>
);

export const DailyWorkSummaryScreen: React.FC = () => {
  const { navigate, currentSummary } = useNav();

  const data: DailySummaryData | null = useMemo(
    () => (currentSummary ? generateDailySummary(currentSummary) : null),
    [currentSummary],
  );

  // ---- Toolbar handlers: Copy / Email / Download --------------
  // `copied` flips the clipboard button's icon to a green check for
  // ~2 seconds so the user gets a visible "it worked" signal —
  // clipboard writes are silent otherwise.
  // `downloading` gates the Download button while jspdf loads and
  // renders the PDF, so double-taps don't kick off a second render.
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleCopy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(toPlainText(data));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can reject in insecure contexts / permissions-denied.
      // Silently ignore — the Email/Download paths are unaffected.
    }
  };

  const handleEmail = () => {
    if (!data) return;
    // mailto: can't attach files, so the body holds the plain-text
    // report plus a nudge pointing the recipient at the Download
    // button for the branded PDF (see summaryExport.toEmailParts).
    window.location.href = buildMailtoUrl(data);
  };

  const handleDownload = async () => {
    if (!data || downloading) return;
    setDownloading(true);
    try {
      // Dynamic import keeps jspdf out of the initial bundle — users
      // who never download a PDF never pay for the ~100kb of ship.
      const { generateDailySummaryPdf, downloadBlob, filenameForSummary } =
        await import('../../lib/summaryPdf');
      const blob = await generateDailySummaryPdf(data);
      downloadBlob(blob, filenameForSummary(data.dateLabel));
    } catch (err) {
      console.error('Failed to generate PDF', err);
    } finally {
      setDownloading(false);
    }
  };

  if (!data) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <EmptyState onBack={() => navigate('prepare-summary')} />
      </div>
    );
  }

  return (
    <>
      {/* ==================== DESKTOP ==================== */}
      <div className="hidden md:flex flex-col h-full overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between max-w-[1100px] mx-auto w-full">
            <div className="flex items-center gap-3">
              <Logo size={28} />
              <div>
                <h1 className="text-lg font-bold text-slate-900">{data.title}</h1>
                <p className="text-xs text-slate-400">{data.dateLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? 'Copied to clipboard' : 'Copy summary as plain text'}
                title={copied ? 'Copied!' : 'Copy as plain text'}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                {copied ? <CheckIconSmall /> : <CopyIcon />}
              </button>
              <button
                type="button"
                onClick={handleEmail}
                aria-label="Email summary"
                title="Email summary"
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                <EmailIcon />
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                aria-label={downloading ? 'Generating PDF' : 'Download summary as PDF'}
                title={downloading ? 'Generating PDF…' : 'Download as PDF'}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {downloading ? <SpinnerIcon /> : <DownloadIcon />}
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-[1100px] mx-auto p-6 space-y-5">
            {data.overtime.isOver && <OvertimeBanner overtime={data.overtime} />}
            <div className="grid grid-cols-5 gap-5">
              <div className="col-span-3 space-y-5">
                <DayCompositionDesktop legend={data.legend} />
                <ByProjectDesktop byProject={data.byProject} />
                <DesktopTimeline timeline={data.timeline} />
                <Classification data={data} />
              </div>
              <div className="col-span-2 space-y-5">
                <AISummaryDesktop narrative={data.narrative} />
                <ScorecardDesktop kpis={data.kpis} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MOBILE ==================== */}
      <div className="md:hidden flex flex-col h-full overflow-hidden">
        <header className="bg-white border-b border-slate-100 px-4 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <Logo size={24} />
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-slate-900 truncate">{data.title}</h1>
                <p className="text-[10px] text-slate-400 truncate">{data.dateLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? 'Copied to clipboard' : 'Copy summary as plain text'}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center"
              >
                {copied ? <CheckIconSmall /> : <CopyIcon />}
              </button>
              <button
                type="button"
                onClick={handleEmail}
                aria-label="Email summary"
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center"
              >
                <EmailIcon />
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                aria-label={downloading ? 'Generating PDF' : 'Download summary as PDF'}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-60 disabled:cursor-wait"
              >
                {downloading ? <SpinnerIcon /> : <DownloadIcon />}
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4">
          {data.overtime.isOver && <OvertimeBanner overtime={data.overtime} compact />}
          <AISummaryMobile narrative={data.narrative} />
          <DayCompositionMobile legend={data.legend} />
          <ByProjectMobile byProject={data.byProject} />
          <MobileTimeline timeline={data.timeline} />
          <Classification data={data} />
          <ScorecardMobile kpis={data.kpis} />
        </div>

        <nav className="bg-white border-t border-slate-100 px-2 pb-6 pt-2 flex items-center justify-around shrink-0">
          <button onClick={() => navigate('home')} className="flex flex-col items-center gap-1 text-slate-400">
            <TrackerIcon />
            <span className="text-[10px]">Tracker</span>
          </button>
          <button onClick={() => navigate('prepare-summary')} className="flex flex-col items-center gap-1 text-blue-500">
            <SummaryIcon />
            <span className="text-[10px] font-semibold">Summary</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-400">
            <TeamIcon />
            <span className="text-[10px]">Team</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-400">
            <MoreIcon />
            <span className="text-[10px]">More</span>
          </button>
        </nav>
      </div>
    </>
  );
};

export default DailyWorkSummaryScreen;
