// ============================================================
// V6 Home Screen — pixel-faithful rebuild from concept
// Source of truth: taskpanels.app/concepts/v6-panel-cards.html
//
// Renders inside AppShell's <main className="flex-1 overflow-auto">
// Desktop: sidebar already provided by AppShell
// Mobile: bottom tab bar already provided by AppShell
// ============================================================

import React, { useEffect, useState } from 'react';
import { useSwipe } from '../../hooks/useSwipe';
import { useNav } from '../../lib/previewNav';
import { AvatarBadge } from '../AvatarBadge';
import { SummaryArchiveScreen } from './SummaryArchiveScreen';
// Back-compat re-exports so any older imports still resolve.
import {
  MOCK_PANELS,
  MEETING_TYPE_LABELS,
  MEETING_AUDIENCE_LABELS,
  type MockPanel,
  type Panel,
} from '../../lib/panelCatalog';
export { MOCK_PANELS, type MockPanel };

// ---- Logo ----

const Logo: React.FC = () => (
  <svg width={28} height={28} viewBox="0 0 32 32">
    <circle cx="10" cy="10" r="5" fill="#3b82f6" />
    <circle cx="22" cy="10" r="5" fill="#f97316" />
    <circle cx="10" cy="22" r="5" fill="#8b5cf6" />
    <circle cx="22" cy="22" r="5" fill="#10b981" />
  </svg>
);

// ---- Main Component ----

export const HomeScreen: React.FC = () => {
  const {
    navigate,
    panels: allPanels,
    panelAccum,
    activeTimer,
    activeBreak,
    breakDurationsMs,
    startBreak,
    breakAccum,
    endMyDay,
    userProfile,
  } = useNav();
  const [activeTab, setActiveTab] = useState<'today' | 'archive'>('today');

  // Swipe left on Today → switch to Archive (mobile tab navigation).
  const todaySwipe = useSwipe({ onSwipeLeft: () => setActiveTab('archive') });

  // Tick every second whenever anything on this screen is counting — a
  // running panel timer, or a break/lunch countdown.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activeTimer && !activeBreak) return;
    const id = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [activeTimer, activeBreak]);

  // Only show live Panel instances that haven't been closed out yet.
  const livePanels: Panel[] = allPanels.filter(p => p.status === 'active');

  // Compute the total ms for a panel instance: accumulated runs + in-flight session.
  const getPanelMs = (id: string): number => {
    const accum = panelAccum[id] ?? 0;
    if (activeTimer && activeTimer.panelId === id) {
      return accum + (Date.now() - activeTimer.startedAt);
    }
    return accum;
  };

  const pad2 = (n: number) => n.toString().padStart(2, '0');
  const formatHMS = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h}:${pad2(m)}:${pad2(s)}`;
  };
  // Compact "1h 22m" / "45m" style for totals.
  const formatHM = (ms: number) => {
    const total = Math.floor(ms / 60000);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h === 0 ? `${m}m` : `${h}h ${m}m`;
  };

  const activeId = activeTimer?.panelId ?? null;

  // Visual view model — running instance pinned to top, idle timer color dimmed.
  type PanelView = Panel & {
    isActive: boolean;
    time: string;
    currentTimerColorClass: string;
  };
  const panelViews: PanelView[] = livePanels
    .map(p => ({
      ...p,
      isActive: p.id === activeId,
      time: formatHMS(getPanelMs(p.id)),
      currentTimerColorClass:
        p.id === activeId ? p.activeColorClass : 'text-slate-500',
    }))
    .sort((a, b) => {
      if (a.isActive === b.isActive) return 0;
      return a.isActive ? -1 : 1;
    });

  const hasActive = activeId !== null;
  const isEmpty = panelViews.length === 0;

  // Live total for an in-progress break (partial duration so far).
  const breakLiveMs = (kind: 'break' | 'lunch') =>
    activeBreak && activeBreak.kind === kind
      ? Math.min(
          activeBreak.durationMs,
          Math.max(0, Date.now() - activeBreak.startedAt)
        )
      : 0;
  const totalBreakMs = (kind: 'break' | 'lunch') =>
    breakAccum[kind] + breakLiveMs(kind);

  // Rows for the "Today's Sessions" card.
  type SessionRow = {
    key: string;
    name: string;
    barClass: string;
    ms: number;
    running: boolean;
    accentClass: string;
    subtitle: string;
  };
  const panelRows: SessionRow[] = livePanels.map(p => ({
    key: `panel-${p.id}`,
    name: p.name,
    barClass: p.barClass,
    ms: getPanelMs(p.id),
    running: p.id === activeId && !activeBreak,
    accentClass: p.activeColorClass,
    subtitle: p.id === activeId && !activeBreak ? 'Running now' : 'Paused',
  }));
  const breakRows: SessionRow[] = (['break', 'lunch'] as const)
    .filter(k => totalBreakMs(k) > 0 || activeBreak?.kind === k)
    .map(k => ({
      key: `break-${k}`,
      name: k === 'break' ? 'Break' : 'Lunch',
      barClass: k === 'break' ? 'bg-amber-400' : 'bg-rose-400',
      ms: totalBreakMs(k),
      running: activeBreak?.kind === k,
      accentClass: k === 'break' ? 'text-amber-600' : 'text-rose-500',
      subtitle:
        activeBreak?.kind === k ? 'On break' : k === 'break' ? 'Break' : 'Lunch',
    }));
  const sessionRows: SessionRow[] = [...panelRows, ...breakRows];

  // Header subtitle total counts work time only, not breaks.
  const totalPanelMs = livePanels.reduce((sum, p) => sum + getPanelMs(p.id), 0);
  const totalLabel = formatHM(totalPanelMs);
  const totalAllMs = totalPanelMs + totalBreakMs('break') + totalBreakMs('lunch');
  const totalAllLabel = formatHM(totalAllMs);

  // Clicking a panel card opens the fullscreen view — does NOT auto-start.
  const openPanel = (id: string) => {
    navigate('panel', { panelId: id });
  };

  // Subtitle helper — reads context fields directly off the Panel instance.
  //
  // Branches on kind so meeting panels don't leak workType/focusNote
  // through as stale context. For a meeting we prefer the explicit
  // topic (e.g. "Q3 launch plan"), and fall back to the
  // meetingType · audience pair (e.g. "Planned · Internal") when the
  // user hasn't filled in a topic yet. Work panels keep the original
  // project → workType → focusNote format.
  const subtitle = (p: Panel) => {
    if (p.kind === 'meeting') {
      let meetingMeta = p.topic?.trim() ?? '';
      if (!meetingMeta) {
        const bits: string[] = [];
        if (p.meetingType) bits.push(MEETING_TYPE_LABELS[p.meetingType]);
        if (p.audience) bits.push(MEETING_AUDIENCE_LABELS[p.audience]);
        meetingMeta = bits.join(' · ');
      }
      const parts = [p.project, meetingMeta].filter(
        (s): s is string => typeof s === 'string' && s.trim().length > 0
      );
      return parts.length > 0 ? parts.join(' → ') : 'No description yet';
    }
    const parts = [p.project, p.workType, p.focusNote].filter(
      (s): s is string => typeof s === 'string' && s.trim().length > 0
    );
    return parts.length > 0 ? parts.join(' → ') : 'No description yet';
  };

  // ---- Break / lunch countdown helpers ----
  const formatMMSS = (ms: number) => {
    const clamped = Math.max(0, ms);
    const total = Math.ceil(clamped / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${pad2(s)}`;
  };
  const breakRemainingMs =
    activeBreak
      ? Math.max(0, activeBreak.startedAt + activeBreak.durationMs - Date.now())
      : 0;
  const isBreakActive = activeBreak?.kind === 'break';
  const isLunchActive = activeBreak?.kind === 'lunch';
  const breakDefaultMin = Math.round(breakDurationsMs.break / 60000);
  const lunchDefaultMin = Math.round(breakDurationsMs.lunch / 60000);

  // Curved arrow pointing down-left toward the "Start Panel" CTA
  const CurvedArrow: React.FC<{ className?: string }> = ({ className }) => (
    <svg
      className={className}
      width="120"
      height="100"
      viewBox="0 0 120 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M100 10 C 100 55, 70 80, 25 85" />
      <path d="M38 78 L 22 86 L 30 72" />
    </svg>
  );

  return (
    <>
      {/* ==========================================
          DESKTOP LAYOUT (md+)
          ========================================== */}
      <div className="hidden md:flex md:flex-col h-full">
        {/* Top Bar */}
        <div className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Today's Panels</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Monday, March 30{isEmpty ? '' : ` — ${totalLabel} tracked`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={endMyDay}
              disabled={isEmpty}
              className="h-9 px-5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              End My Day
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="bg-white border-b border-slate-100 px-8 flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => setActiveTab('today')} className={`px-4 py-3 text-sm font-semibold border-b-2 ${activeTab === 'today' ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
            Today
          </button>
          <button type="button" onClick={() => setActiveTab('archive')} className={`px-4 py-3 text-sm font-semibold border-b-2 ${activeTab === 'archive' ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
            Archive
          </button>
        </div>

        {/* Scrollable: Panel List + Right Sidebar */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'archive' && <SummaryArchiveScreen embedded />}
          {activeTab === 'today' && <div className="flex gap-6 p-6 max-w-[1200px]">
            {/* Main Column */}
            <div className="flex-1 space-y-3">
              {isEmpty && (
                <div className="relative py-10 pb-2 text-center">
                  <h2 className="text-2xl font-bold text-slate-700 mb-2">No panels yet</h2>
                  <p className="text-sm text-slate-400 mb-6">
                    Click <span className="font-semibold text-slate-600">"Start Panel"</span> below to add your first one
                  </p>
                  <div className="flex justify-start pl-8">
                    <CurvedArrow className="text-slate-300" />
                  </div>
                </div>
              )}

              {panelViews.map(panel => (
                <button
                  key={panel.id}
                  onClick={() => openPanel(panel.id)}
                  className={`w-full text-left panel-card ${panel.bgClass} rounded-2xl border ${panel.borderClass} p-5 hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-14 rounded-full ${panel.barClass} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-lg font-bold text-slate-900">{panel.name}</h3>
                        {panel.isActive && (
                          <div className="flex items-center gap-1">
                            <span className={`timer-pulse block w-1.5 h-1.5 rounded-full ${panel.barClass}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${panel.activeColorClass}`}>Active</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 truncate">{subtitle(panel)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-2xl font-mono font-bold ${panel.currentTimerColorClass} tabular-nums tracking-tight`}>{panel.time}</p>
                    </div>
                  </div>
                </button>
              ))}

              {/* Break / Lunch — hidden while empty */}
              {!isEmpty && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => startBreak('break')}
                  className={`panel-card flex-1 rounded-2xl border p-4 flex items-center gap-3 transition-shadow hover:shadow-md text-left ${
                    isBreakActive
                      ? 'bg-amber-100 border-amber-300 ring-2 ring-amber-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700">Break</p>
                    <p className={`text-xs tabular-nums ${isBreakActive ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                      {isBreakActive ? `${formatMMSS(breakRemainingMs)} left` : `${breakDefaultMin} min`}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => startBreak('lunch')}
                  className={`panel-card flex-1 rounded-2xl border p-4 flex items-center gap-3 transition-shadow hover:shadow-md text-left ${
                    isLunchActive
                      ? 'bg-rose-100 border-rose-300 ring-2 ring-rose-200'
                      : 'bg-rose-50 border-rose-200'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 3h18M3 7h18M9 11l3 10 3-10" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700">Lunch</p>
                    <p className={`text-xs tabular-nums ${isLunchActive ? 'text-rose-700 font-semibold' : 'text-slate-400'}`}>
                      {isLunchActive ? `${formatMMSS(breakRemainingMs)} left` : `${lunchDefaultMin} min`}
                    </p>
                  </div>
                </button>
              </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => navigate('pick-panel')} className="flex-1 h-12 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /></svg>
                  {hasActive ? 'Switch Panel' : 'Start Panel'}
                </button>
                <button onClick={() => navigate('prepare-summary')} className="flex-1 h-12 border border-slate-200 bg-white text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                  Generate Summary
                </button>
              </div>
            </div>

            {/* Right Sidebar — Stats + Sessions (lg+ only, hidden while empty) */}
            {!isEmpty && (
            <div className="w-[320px] shrink-0 space-y-4 hidden lg:block">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Today's Stats</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-blue-600">6h 47m</p>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">Focus Time</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-emerald-600">5 / 8</p>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">Tasks Done</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-purple-600">{livePanels.length}</p>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">Panels</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-slate-700">87%</p>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">Productive</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sessions</h3>
                  <span className="text-[10px] font-medium text-slate-400">{totalAllLabel} total</span>
                </div>
                <div className="space-y-3">
                  {sessionRows.map(row => (
                    <div key={row.key} className="flex items-center gap-3">
                      <div className={`w-1 h-8 rounded-full ${row.barClass}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{row.name}</p>
                        <p className="text-[10px] text-slate-400">{row.subtitle}</p>
                      </div>
                      <span className={`text-xs font-mono tabular-nums ${row.running ? row.accentClass : 'text-slate-500'}`}>
                        {formatHMS(row.ms)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}
          </div>}
        </div>
      </div>

      {/* ==========================================
          MOBILE LAYOUT (< md)
          ========================================== */}
      <div className="md:hidden">
        {/* Mobile Header — sticky at top of scroll area */}
        <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 pt-3 pb-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Logo />
              <h1 className="text-lg font-bold text-slate-900">Today's Panels</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={endMyDay}
                disabled={isEmpty}
                aria-label="End my day"
                className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
              >
                <svg className="w-[14px] h-[14px]" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <rect x="3" y="3" width="10" height="10" rx="1" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => navigate('profile')}
                aria-label="My profile"
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              >
                <AvatarBadge profile={userProfile} size="sm" />
              </button>
            </div>
          </div>

          {/* Tab Bar — inside header so it sticks too */}
          <div className="flex items-center gap-1 -mb-px">
            <button type="button" onClick={() => setActiveTab('today')} className={`px-4 py-2.5 text-sm font-semibold border-b-2 ${activeTab === 'today' ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent'}`}>
              Today
            </button>
            <button type="button" onClick={() => setActiveTab('archive')} className={`px-4 py-2.5 text-sm font-semibold border-b-2 ${activeTab === 'archive' ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent'}`}>
              Archive
            </button>
          </div>
        </header>

        {/* Scrollable content — natural flow, no nested overflow */}
        {activeTab === 'archive' && <SummaryArchiveScreen embedded />}
        <div className={`px-4 py-4 space-y-3 ${activeTab === 'archive' ? 'hidden' : ''}`} {...todaySwipe}>
          {isEmpty && (
            <div className="py-8 text-center">
              <h2 className="text-lg font-bold text-slate-700 mb-1.5">No panels yet</h2>
              <p className="text-xs text-slate-400 mb-4">
                Tap <span className="font-semibold text-slate-600">"Start Panel"</span> below to add one
              </p>
              <div className="flex justify-start pl-4">
                <CurvedArrow className="text-slate-300 w-24 h-20" />
              </div>
            </div>
          )}

          {/* Panel Cards */}
          {panelViews.map(panel => (
            <button
              key={panel.id}
              onClick={() => openPanel(panel.id)}
              className={`w-full text-left panel-card ${panel.bgClass} rounded-2xl border ${panel.borderClass} p-4`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-1.5 h-12 rounded-full ${panel.barClass} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900">{panel.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle(panel)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xl font-mono font-bold ${panel.currentTimerColorClass} tabular-nums tracking-tight`}>{panel.time}</p>
                  {panel.isActive && (
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <span className={`timer-pulse block w-1.5 h-1.5 rounded-full ${panel.barClass}`} />
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${panel.activeColorClass}`}>Active</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}

          {/* Break / Lunch — hidden while empty */}
          {!isEmpty && (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => startBreak('break')}
              className={`panel-card flex-1 rounded-2xl border p-3.5 flex items-center gap-2.5 text-left ${
                isBreakActive
                  ? 'bg-amber-100 border-amber-300 ring-2 ring-amber-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">Break</p>
                <p className={`text-[10px] tabular-nums ${isBreakActive ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                  {isBreakActive ? `${formatMMSS(breakRemainingMs)} left` : `${breakDefaultMin} min`}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => startBreak('lunch')}
              className={`panel-card flex-1 rounded-2xl border p-3.5 flex items-center gap-2.5 text-left ${
                isLunchActive
                  ? 'bg-rose-100 border-rose-300 ring-2 ring-rose-200'
                  : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 3h18M3 7h18M9 11l3 10 3-10" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">Lunch</p>
                <p className={`text-[10px] tabular-nums ${isLunchActive ? 'text-rose-700 font-semibold' : 'text-slate-400'}`}>
                  {isLunchActive ? `${formatMMSS(breakRemainingMs)} left` : `${lunchDefaultMin} min`}
                </p>
              </div>
            </button>
          </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2.5 pt-1">
            <button onClick={() => navigate('pick-panel')} className="flex-1 h-12 bg-slate-900 text-white font-semibold rounded-xl flex items-center justify-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /></svg>
              {hasActive ? 'Switch Panel' : 'Start Panel'}
            </button>
            <button onClick={() => navigate('prepare-summary')} className="flex-1 h-12 border border-slate-200 bg-white text-slate-600 font-semibold rounded-xl flex items-center justify-center text-sm">
              Generate Summary
            </button>
          </div>

          {/* Session Summary Card — hidden while empty */}
          {!isEmpty && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Sessions</h3>
              <span className="text-xs text-slate-400">{totalAllLabel} total</span>
            </div>
            <div className="space-y-2.5">
              {sessionRows.map(row => (
                <div key={row.key} className="flex items-center gap-2.5">
                  <div className={`w-1 h-6 rounded-full ${row.barClass}`} />
                  <span className="text-sm text-slate-700 flex-1 truncate">{row.name}</span>
                  <span className={`text-xs font-mono tabular-nums ${row.running ? row.accentClass : 'text-slate-400'}`}>
                    {formatHMS(row.ms)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Bottom spacer */}
          <div className="h-4" />
        </div>
      </div>
    </>
  );
};
