// ============================================================
// Performance Review
// ------------------------------------------------------------
// Reads the snapshot from nav.currentSummary and renders via
// generatePerformanceReview. Sections without backing data are
// hidden per the roadmap's "capture truth, then shape it" rule:
//   - Weekly Productivity Trend (needs weekly rollups)
//   - Quarter-over-Quarter comparison (needs historical windows)
//   - "Productivity Score" (invented metric)
// ============================================================

import React, { useMemo } from 'react';
import { useNav } from '../../lib/previewNav';
import {
  formatHM,
  generatePerformanceReview,
  type PerformanceReviewData,
  type LegendEntry,
  type ProjectBreakdown,
  type KPI,
} from '../../lib/summaryModel';

// ---- Icons ----

const Logo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <circle cx="8" cy="8" r="5" fill="#3b82f6" />
    <circle cx="20" cy="8" r="5" fill="#10b981" />
    <circle cx="8" cy="20" r="5" fill="#f97316" />
    <circle cx="20" cy="20" r="5" fill="#8b5cf6" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const EmailIcon = () => (
  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 4l-10 8L2 4" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// Note: CheckIconSmall / SpinnerIcon are intentionally omitted until the
// Copy / Download buttons in this screen get their handlers wired up —
// declaring unused components would trip noUnusedLocals. Add them back
// alongside the handlers when we adapt toPlainText / generatePdf for
// PerformanceReviewData.

// Tab bar icons (matching DailyWorkSummaryScreen)
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

const LightningIcon = ({ className = 'w-4 h-4 text-white' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

// ---- Donut (same as Daily, but co-located so this file stands alone) ----

const DonutChart: React.FC<{ size?: number; legend: LegendEntry[] }> = ({ size = 160, legend }) => {
  const r = 60;
  const circumference = 2 * Math.PI * r;
  let running = 0;
  const nonZero = legend.filter(l => l.pct > 0);
  if (nonZero.length === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#f1f5f9" strokeWidth={24} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <circle cx="80" cy="80" r={r} fill="none" stroke="#f1f5f9" strokeWidth={24} />
      {nonZero.map(slice => {
        const len = (slice.pct / 100) * circumference;
        const arc = (
          <circle
            key={slice.panelId}
            cx="80"
            cy="80"
            r={r}
            fill="none"
            stroke={slice.colorHex}
            strokeWidth={24}
            strokeDasharray={`${len} ${circumference - len}`}
            strokeDashoffset={-running}
            transform="rotate(-90 80 80)"
            strokeLinecap="butt"
          />
        );
        running += len;
        return arc;
      })}
    </svg>
  );
};

// ---- KPI cards ----

const KPI_CARD_STYLES = [
  { bg: 'bg-blue-50',    border: 'border-blue-200',    stroke: '#3b82f6' },
  { bg: 'bg-purple-50',  border: 'border-purple-200',  stroke: '#8b5cf6' },
  { bg: 'bg-orange-50',  border: 'border-orange-200',  stroke: '#f97316' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', stroke: '#10b981' },
];

const KPICards: React.FC<{ kpis: KPI[] }> = ({ kpis }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {kpis.map((kpi, i) => {
      const s = KPI_CARD_STYLES[i % KPI_CARD_STYLES.length];
      return (
        <div key={kpi.label} className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
          <div className={`w-12 h-12 rounded-2xl ${s.bg} border ${s.border} mx-auto mb-3 flex items-center justify-center`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={s.stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-slate-900">{kpi.value}</div>
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-1">{kpi.label}</div>
          {kpi.sub && <div className="text-[10px] text-slate-400 mt-1">{kpi.sub}</div>}
        </div>
      );
    })}
  </div>
);

// ---- Time Allocation ----

const TimeAllocation: React.FC<{ allocation: LegendEntry[]; rangeLabel: string }> = ({ allocation, rangeLabel }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6">
    <h3 className="text-sm font-semibold text-slate-700 mb-1">Time Allocation by Workstream</h3>
    <p className="text-xs text-slate-400 mb-4">{rangeLabel}</p>
    <div className="flex items-center gap-6">
      <DonutChart size={160} legend={allocation} />
      <div className="flex-1 space-y-2 min-w-0">
        {allocation.length === 0 && <p className="text-xs text-slate-400">No tracked time.</p>}
        {allocation.map(a => (
          <div key={a.panelId} className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.colorHex }} />
            <span className="text-xs text-slate-700 truncate">{a.name}</span>
            <span className="text-xs font-mono text-slate-500 ml-auto">{a.time}</span>
            <span className="text-[11px] font-semibold text-slate-400 tabular-nums w-8 text-right">{a.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ---- By Project: the major reporting dimension ----
//
// Projects are first-class in Performance Reviews. This section is sized
// to be one of the most prominent on the page — what's the work for, who
// is it for, where did the time go. Each row exposes time, the focus/
// meeting split, completion ratio, and growth-area counts so a manager
// or client can scan a single block and understand the period.

const ProjectStatCell: React.FC<{
  label: string;
  value: string | number;
  accent?: 'slate' | 'emerald' | 'orange' | 'purple';
}> = ({ label, value, accent = 'slate' }) => {
  const valueClasses: Record<string, string> = {
    slate: 'text-slate-800',
    emerald: 'text-emerald-600',
    orange: 'text-orange-600',
    purple: 'text-purple-600',
  };
  return (
    <div>
      <p className={`text-base font-bold tabular-nums ${valueClasses[accent]}`}>{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">{label}</p>
    </div>
  );
};

const ProjectBreakdownDesktop: React.FC<{ byProject: ProjectBreakdown[]; rangeLabel: string }> = ({
  byProject,
  rangeLabel,
}) => {
  if (byProject.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-700">By Project</h3>
        <span className="text-[11px] text-slate-400">{byProject.length} {byProject.length === 1 ? 'project' : 'projects'}</span>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Time, outcomes, and unrealized effort by project · {rangeLabel}
      </p>
      <div className="space-y-3">
        {byProject.map(p => {
          const ratio =
            p.workstreamCount > 0
              ? Math.round((p.completedCount / p.workstreamCount) * 100)
              : 0;
          return (
            <div
              key={p.projectName}
              className={`rounded-xl border p-4 ${
                p.isUnassigned ? 'bg-slate-50 border-dashed border-slate-200' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-3 h-3 rounded-full ${p.barClass} shrink-0`} />
                <span
                  className={`text-sm font-bold ${
                    p.isUnassigned ? 'text-slate-500 italic' : 'text-slate-900'
                  }`}
                >
                  {p.projectName}
                </span>
                <span className="text-[11px] text-slate-400 ml-1 tabular-nums">{p.pct}% of total</span>
                <span className="text-sm font-mono font-semibold text-slate-800 ml-auto tabular-nums">
                  {formatHM(p.totalMs)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden mb-3">
                <div className={`h-full ${p.barClass}`} style={{ width: `${Math.max(2, p.pct)}%` }} />
              </div>
              {/* Stats grid */}
              <div className="grid grid-cols-5 gap-3 mb-3">
                <ProjectStatCell label="Focus" value={formatHM(p.focusMs)} />
                <ProjectStatCell label="Meetings" value={p.meetingMs > 0 ? formatHM(p.meetingMs) : '—'} />
                <ProjectStatCell label="Streams" value={p.workstreamCount} />
                <ProjectStatCell label="Completed" value={`${p.completedCount}/${p.workstreamCount}`} accent="emerald" />
                <ProjectStatCell label="Done %" value={`${ratio}%`} accent="emerald" />
              </div>
              {/* Outcome chips */}
              {(p.blockedCount > 0 || p.followUpCount > 0 || p.unrealizedEffortCount > 0) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {p.blockedCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 text-[11px] font-semibold">
                      <span className="tabular-nums">{p.blockedCount}</span> blocked
                    </span>
                  )}
                  {p.followUpCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[11px] font-semibold">
                      <span className="tabular-nums">{p.followUpCount}</span> follow-up
                    </span>
                  )}
                  {p.unrealizedEffortCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 text-[11px] font-semibold">
                      <span className="tabular-nums">{p.unrealizedEffortCount}</span> unrealized effort
                    </span>
                  )}
                </div>
              )}
              {p.workstreamNames.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-2">
                  Workstreams: <span className="text-slate-500">{p.workstreamNames.join(' · ')}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ProjectBreakdownMobile: React.FC<{ byProject: ProjectBreakdown[] }> = ({ byProject }) => {
  if (byProject.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">By Project</h3>
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
                className={`text-xs font-bold truncate ${
                  p.isUnassigned ? 'text-slate-500 italic' : 'text-slate-900'
                }`}
              >
                {p.projectName}
              </span>
              <span className="text-[10px] text-slate-400 ml-0.5 tabular-nums">{p.pct}%</span>
              <span className="text-[11px] font-mono font-semibold text-slate-800 ml-auto tabular-nums">
                {formatHM(p.totalMs)}
              </span>
            </div>
            <div className="h-1 rounded-full bg-slate-200 overflow-hidden mb-1.5">
              <div className={`h-full ${p.barClass}`} style={{ width: `${Math.max(2, p.pct)}%` }} />
            </div>
            <div className="flex items-center justify-between gap-1.5">
              <p className="text-[10px] text-slate-500 truncate">
                {formatHM(p.focusMs)} focus
                {p.meetingMs > 0 && ` · ${formatHM(p.meetingMs)} mtg`}
                {' · '}
                {p.completedCount}/{p.workstreamCount} done
              </p>
              <div className="flex items-center gap-1 shrink-0">
                {p.blockedCount > 0 && (
                  <span className="px-1 py-0.5 rounded bg-orange-50 text-orange-700 text-[9px] font-semibold tabular-nums">
                    {p.blockedCount}b
                  </span>
                )}
                {p.followUpCount > 0 && (
                  <span className="px-1 py-0.5 rounded bg-purple-50 text-purple-700 text-[9px] font-semibold tabular-nums">
                    {p.followUpCount}f
                  </span>
                )}
                {p.unrealizedEffortCount > 0 && (
                  <span className="px-1 py-0.5 rounded bg-slate-200 text-slate-600 text-[9px] font-semibold tabular-nums">
                    {p.unrealizedEffortCount}u
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- Top Accomplishments ----

const TopAccomplishments: React.FC<{ items: PerformanceReviewData['topAccomplishments'] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">Top Accomplishments</h3>
      <p className="text-xs text-slate-400 mb-4">Largest completed workstreams by tracked time</p>
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={item.name} className="flex items-start gap-3">
            <span className="inline-flex w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <div className={`w-1 self-stretch rounded-full ${item.barClass} shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800 truncate">{item.name}</span>
                <span className="text-xs font-mono text-slate-500 ml-auto shrink-0">{item.time}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

// ---- Key Achievements (completed with narrative detail) ----

const KeyAchievements: React.FC<{ items: PerformanceReviewData['keyAchievements'] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Key Achievements</h3>
      <ul className="space-y-3">
        {items.map(item => (
          <li key={item.name} className="flex gap-3">
            <div className={`w-1 self-stretch rounded-full ${item.barClass} shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{item.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ---- Growth Areas (blockers + follow-ups + abandoned) ----

const GrowthAreas: React.FC<{ items: PerformanceReviewData['growthAreas'] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">Growth Areas</h3>
      <p className="text-xs text-slate-400 mb-4">Blockers, pending follow-ups, and deprioritized efforts</p>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex gap-3">
            <div className={`w-1 self-stretch rounded-full ${item.barClass} shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{item.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ---- Narrative (AI-style summary block) ----

const Narrative: React.FC<{ narrative: string[] }> = ({ narrative }) => (
  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
        <LightningIcon className="w-4 h-4 text-white" />
      </div>
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Executive Summary</h2>
    </div>
    <div className="space-y-2">
      {narrative.map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-slate-300">{p}</p>
      ))}
    </div>
  </div>
);

// ---- Empty state ----

const EmptyState: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
    <div className="max-w-sm text-center space-y-3">
      <h2 className="text-base font-bold text-slate-900">No review generated yet</h2>
      <p className="text-sm text-slate-500">
        Open Prepare Summary, choose <em>Performance Review</em> and a date range, then tap Generate Summary.
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

// ---- Main ----

const PerformanceReviewScreen: React.FC = () => {
  const { navigate, currentSummary } = useNav();

  const data: PerformanceReviewData | null = useMemo(
    () => (currentSummary ? generatePerformanceReview(currentSummary) : null),
    [currentSummary],
  );

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
        {/* Header matches DailyWorkSummaryScreen's so the two report
            screens feel like the same family. Title is the label-free
            report name; the range label goes in the subtitle slot where
            Daily puts its dateLabel. */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between max-w-[1100px] mx-auto w-full">
            <div className="flex items-center gap-3">
              <Logo size={28} />
              <div>
                <h1 className="text-lg font-bold text-slate-900">Performance Review</h1>
                <p className="text-xs text-slate-400">{data.rangeLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Copy summary"
                title="Copy summary"
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                <CopyIcon />
              </button>
              <button
                type="button"
                aria-label="Email summary"
                title="Email summary"
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                <EmailIcon />
              </button>
              <button
                type="button"
                aria-label="Download as PDF"
                title="Download as PDF"
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                <DownloadIcon />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto hide-scrollbar">
          <div className="max-w-[1100px] mx-auto p-8 space-y-6">
            <KPICards kpis={data.kpis} />
            <Narrative narrative={data.narrative} />
            <ProjectBreakdownDesktop byProject={data.byProject} rangeLabel={data.rangeLabel} />
            <TimeAllocation allocation={data.allocation} rangeLabel={data.rangeLabel} />
            <div className="grid grid-cols-2 gap-6">
              <TopAccomplishments items={data.topAccomplishments} />
              <KeyAchievements items={data.keyAchievements} />
            </div>
            <GrowthAreas items={data.growthAreas} />
          </div>
        </div>
      </div>

      {/* ==================== MOBILE ==================== */}
      <div className="md:hidden flex flex-col h-full overflow-hidden">
        {/* Header matches DailyWorkSummaryScreen's mobile header —
            same logo size, same title/subtitle treatment — so the
            two report screens feel like one family on phones too. */}
        <header className="bg-white border-b border-slate-100 px-4 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <Logo size={24} />
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-slate-900 truncate">Performance Review</h1>
                <p className="text-[10px] text-slate-400 truncate">{data.rangeLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                aria-label="Copy summary"
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                <CopyIcon />
              </button>
              <button
                type="button"
                aria-label="Email summary"
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                <EmailIcon />
              </button>
              <button
                type="button"
                aria-label="Download as PDF"
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                <DownloadIcon />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4">
          <KPICards kpis={data.kpis} />
          <Narrative narrative={data.narrative} />
          <ProjectBreakdownMobile byProject={data.byProject} />
          <TimeAllocation allocation={data.allocation} rangeLabel={data.rangeLabel} />
          <TopAccomplishments items={data.topAccomplishments} />
          <KeyAchievements items={data.keyAchievements} />
          <GrowthAreas items={data.growthAreas} />
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

export { PerformanceReviewScreen };
export default PerformanceReviewScreen;
