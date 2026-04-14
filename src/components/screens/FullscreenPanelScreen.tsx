// ============================================================
// Fullscreen Panel Screen — pixel-faithful rebuild from concept
// Design-first, MOCK DATA only (no app context, no Supabase)
//
// Two layouts: desktop (hidden md:flex) and mobile (md:hidden)
// This is a fullscreen overlay — bg-white, no sidebar, no bottom nav
//
// Picks up the selected panel from NavContext so the header shows
// the right name + color, and the Customize Panel color picker
// updates the theme in real time.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNav } from '../../lib/previewNav';
import { makePanelFromType, DEFAULT_PANELS } from '../../lib/panelCatalog';
import { ProjectPicker } from '../ProjectPicker';

// ---- Mock Data ----

const WORK_TYPES = ['Coding', 'Writing', 'Strategy', 'Research', 'Review', 'Revisions', 'Meeting', 'Admin'];

// Keep this list in lock-step with PANEL_COLOR_OPTIONS in lib/panelCatalog.ts.
// Every catalog color MUST have an entry in THEME below or the fullscreen
// color picker will silently fall back to blue.
type ColorName = 'blue' | 'emerald' | 'orange' | 'purple' | 'rose' | 'teal' | 'amber' | 'slate';

const COLORS: { name: ColorName; bg: string }[] = [
  { name: 'blue', bg: 'bg-blue-500' },
  { name: 'emerald', bg: 'bg-emerald-500' },
  { name: 'orange', bg: 'bg-orange-400' },
  { name: 'purple', bg: 'bg-purple-500' },
  { name: 'rose', bg: 'bg-rose-500' },
  { name: 'amber', bg: 'bg-amber-400' },
  { name: 'teal', bg: 'bg-teal-500' },
  { name: 'slate', bg: 'bg-slate-500' },
];

// Full theme per color — every variant is a literal class string so
// Tailwind's source scanner picks them up.
type Theme = {
  headerBg: string;
  headerBorder: string;
  iconBg: string;
  iconBorder: string;
  iconHoverBorder: string;
  iconText: string;
  bar: string;
  dot: string;
  text: string;
  progress: string;
  // Raw hex values for CSS custom properties (range thumb, selected chip, etc.)
  accent: string;        // 500 (400 for orange/amber)
  accentSoft: string;    // 50
  accentBorder: string;  // 200
  accentText: string;    // 600
};

const THEME: Record<ColorName, Theme> = {
  blue: {
    headerBg: 'bg-blue-50',
    headerBorder: 'border-blue-100',
    iconBg: 'bg-blue-100',
    iconBorder: 'border-blue-200',
    iconHoverBorder: 'group-hover:border-blue-300',
    iconText: 'text-blue-600',
    bar: 'bg-blue-500',
    dot: 'bg-blue-500',
    text: 'text-blue-500',
    progress: 'bg-blue-500',
    accent: '#3b82f6',
    accentSoft: '#eff6ff',
    accentBorder: '#bfdbfe',
    accentText: '#2563eb',
  },
  emerald: {
    headerBg: 'bg-emerald-50',
    headerBorder: 'border-emerald-100',
    iconBg: 'bg-emerald-100',
    iconBorder: 'border-emerald-200',
    iconHoverBorder: 'group-hover:border-emerald-300',
    iconText: 'text-emerald-600',
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-500',
    text: 'text-emerald-500',
    progress: 'bg-emerald-500',
    accent: '#10b981',
    accentSoft: '#ecfdf5',
    accentBorder: '#a7f3d0',
    accentText: '#059669',
  },
  orange: {
    headerBg: 'bg-orange-50',
    headerBorder: 'border-orange-100',
    iconBg: 'bg-orange-100',
    iconBorder: 'border-orange-200',
    iconHoverBorder: 'group-hover:border-orange-300',
    iconText: 'text-orange-600',
    bar: 'bg-orange-400',
    dot: 'bg-orange-400',
    text: 'text-orange-500',
    progress: 'bg-orange-400',
    accent: '#fb923c',
    accentSoft: '#fff7ed',
    accentBorder: '#fed7aa',
    accentText: '#ea580c',
  },
  purple: {
    headerBg: 'bg-purple-50',
    headerBorder: 'border-purple-100',
    iconBg: 'bg-purple-100',
    iconBorder: 'border-purple-200',
    iconHoverBorder: 'group-hover:border-purple-300',
    iconText: 'text-purple-600',
    bar: 'bg-purple-500',
    dot: 'bg-purple-500',
    text: 'text-purple-500',
    progress: 'bg-purple-500',
    accent: '#a855f7',
    accentSoft: '#faf5ff',
    accentBorder: '#e9d5ff',
    accentText: '#9333ea',
  },
  rose: {
    headerBg: 'bg-rose-50',
    headerBorder: 'border-rose-100',
    iconBg: 'bg-rose-100',
    iconBorder: 'border-rose-200',
    iconHoverBorder: 'group-hover:border-rose-300',
    iconText: 'text-rose-600',
    bar: 'bg-rose-500',
    dot: 'bg-rose-500',
    text: 'text-rose-500',
    progress: 'bg-rose-500',
    accent: '#f43f5e',
    accentSoft: '#fff1f2',
    accentBorder: '#fecdd3',
    accentText: '#e11d48',
  },
  teal: {
    headerBg: 'bg-teal-50',
    headerBorder: 'border-teal-100',
    iconBg: 'bg-teal-100',
    iconBorder: 'border-teal-200',
    iconHoverBorder: 'group-hover:border-teal-300',
    iconText: 'text-teal-600',
    bar: 'bg-teal-500',
    dot: 'bg-teal-500',
    text: 'text-teal-500',
    progress: 'bg-teal-500',
    accent: '#14b8a6',
    accentSoft: '#f0fdfa',
    accentBorder: '#99f6e4',
    accentText: '#0d9488',
  },
  amber: {
    headerBg: 'bg-amber-50',
    headerBorder: 'border-amber-100',
    iconBg: 'bg-amber-100',
    iconBorder: 'border-amber-200',
    iconHoverBorder: 'group-hover:border-amber-300',
    iconText: 'text-amber-600',
    bar: 'bg-amber-400',
    dot: 'bg-amber-400',
    text: 'text-amber-600',
    progress: 'bg-amber-400',
    accent: '#fbbf24',
    accentSoft: '#fffbeb',
    accentBorder: '#fde68a',
    accentText: '#d97706',
  },
  slate: {
    headerBg: 'bg-slate-100',
    headerBorder: 'border-slate-200',
    iconBg: 'bg-slate-200',
    iconBorder: 'border-slate-300',
    iconHoverBorder: 'group-hover:border-slate-400',
    iconText: 'text-slate-700',
    bar: 'bg-slate-500',
    dot: 'bg-slate-500',
    text: 'text-slate-600',
    progress: 'bg-slate-500',
    accent: '#64748b',
    accentSoft: '#f8fafc',
    accentBorder: '#cbd5e1',
    accentText: '#475569',
  },
};

// SVG icon paths for the 6 icon options
const ICON_PATHS = [
  // monitor
  <path key="monitor" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  // code
  <path key="code" d="M16 18l6-6-6-6M8 6l-6 6 6 6" />,
  // edit
  <path key="edit" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
  // chat
  <path key="chat" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
  // chart
  <path key="chart" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  // camera
  <path key="camera" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />,
];

const SESSION_STATES: { id: string; label: string; icon: React.ReactNode }[] = [
  {
    id: 'focused',
    label: 'Focused',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    id: 'revisiting',
    label: 'Revisiting',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    id: 'stuck',
    label: 'Stuck',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
  },
  {
    id: 'wrapping',
    label: 'Wrapping',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
];

const isColorName = (v: string): v is ColorName =>
  v === 'blue' || v === 'emerald' || v === 'orange' || v === 'purple' ||
  v === 'rose' || v === 'teal' || v === 'amber' || v === 'slate';

// ---- Component ----

export function FullscreenPanelScreen() {
  const {
    navigate,
    selectedPanelId,
    panels,
    panelAccum,
    activeTimer,
    startPanelTimer,
    stopPanelTimer,
    setPanelElapsed,
    updatePanel,
    projects,
  } = useNav();
  const goHome = () => navigate('home');

  // Resolve the selected live Panel instance. If nothing matches (e.g. the
  // user landed here in isolation) fall back to a synthesized instance of
  // the first seed type so the screen still renders.
  const panel =
    panels.find(p => p.id === selectedPanelId) ??
    panels[0] ??
    makePanelFromType(DEFAULT_PANELS[0]);

  // Initialize form state from the Panel instance itself.
  const initialColor: ColorName = isColorName(panel.color)
    ? panel.color
    : 'emerald';

  const [selectedColor, setSelectedColor] = useState<ColorName>(initialColor);
  const [selectedWorkType, setSelectedWorkType] = useState(panel.workType ?? 'Coding');
  const [selectedIcon, setSelectedIcon] = useState(panel.iconIndex ?? 0);
  const [focusNote, setFocusNote] = useState(panel.focusNote ?? '');
  const [notes, setNotes] = useState(panel.notes ?? '');

  // Resolve initial project: prefer projectId, fall back to matching the
  // legacy `project` string by name (so panels created before the Project
  // entity existed still show the right selection on first paint).
  const initialProjectId = useMemo(() => {
    if (panel.projectId) return panel.projectId;
    if (panel.project) {
      const match = projects.find(p => p.name === panel.project);
      if (match) return match.id;
    }
    return undefined;
    // Resolved once per panel mount — picker drives subsequent changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel.id]);
  const [projectId, setProjectId] = useState<string | undefined>(initialProjectId);

  const [tags, setTags] = useState<string[]>(panel.tags ?? ['frontend', 'responsive']);
  const [tagDraft, setTagDraft] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [sessionState, setSessionState] = useState<string>(panel.sessionState ?? '');

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/^#/, '').toLowerCase();
    if (!t) return;
    setTags(prev => (prev.includes(t) ? prev : [...prev, t]));
    setTagDraft('');
    setShowTagInput(false);
  };
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));
  const toggleSessionState = (id: string) =>
    setSessionState(prev => (prev === id ? '' : id));

  // Auto-save each field into the shared draft store whenever it changes.
  // Effects run after paint so typing stays snappy, and the context write
  // is a no-op-shaped object spread — no network, no debouncing needed.
  useEffect(() => {
    updatePanel(panel.id, { color: selectedColor });
  }, [panel.id, selectedColor, updatePanel]);
  useEffect(() => {
    updatePanel(panel.id, { workType: selectedWorkType });
  }, [panel.id, selectedWorkType, updatePanel]);
  useEffect(() => {
    updatePanel(panel.id, { iconIndex: selectedIcon });
  }, [panel.id, selectedIcon, updatePanel]);
  useEffect(() => {
    updatePanel(panel.id, { focusNote });
  }, [panel.id, focusNote, updatePanel]);
  useEffect(() => {
    updatePanel(panel.id, { notes });
  }, [panel.id, notes, updatePanel]);
  // Persist both the canonical projectId and a snapshotted display name
  // so legacy summary code that reads `project` keeps working.
  useEffect(() => {
    if (!projectId) {
      updatePanel(panel.id, { projectId: undefined, project: undefined });
      return;
    }
    const proj = projects.find(p => p.id === projectId);
    updatePanel(panel.id, { projectId, project: proj?.name });
  }, [panel.id, projectId, projects, updatePanel]);
  useEffect(() => {
    updatePanel(panel.id, { tags });
  }, [panel.id, tags, updatePanel]);
  useEffect(() => {
    updatePanel(panel.id, { sessionState });
  }, [panel.id, sessionState, updatePanel]);

  // Tick so the display updates once a second while a timer is running.
  const [, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!activeTimer) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeTimer]);

  const isRunning = activeTimer?.panelId === panel.id;
  const isPaused = !isRunning; // "not timing this panel" reads as paused in the UI
  const elapsedMs =
    (panelAccum[panel.id] ?? 0) +
    (isRunning ? Date.now() - activeTimer!.startedAt : 0);

  const togglePause = () => {
    if (isRunning) {
      stopPanelTimer();
    } else {
      startPanelTimer(panel.id);
    }
  };

  // ---- Slider-driven session-time editing ----
  // The Session Time slider is the only input — drag to set elapsed.
  // Range is 0–480 minutes (0h–8h workday). Each onChange commits via
  // setPanelElapsed, which also resets the in-flight run from "now"
  // so the live tick keeps moving forward from the new value.
  const SLIDER_MAX_MIN = 8 * 60;
  const elapsedMin = Math.min(SLIDER_MAX_MIN, Math.floor(elapsedMs / 60000));
  const onSlideElapsed = (e: React.ChangeEvent<HTMLInputElement>) => {
    const min = Math.max(0, Math.min(SLIDER_MAX_MIN, parseInt(e.target.value, 10) || 0));
    setPanelElapsed(panel.id, min * 60 * 1000);
  };

  // ---- Formatters ----
  const pad2 = (n: number) => n.toString().padStart(2, '0');

  const formatHMS = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h}:${pad2(m)}:${pad2(s)}`;
  };

  const formatHM = (ms: number) => {
    const total = Math.floor(ms / 60000);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h === 0 ? `${m}m` : `${h}h ${m}m`;
  };

  const formatClock = (ts: number) => {
    const d = new Date(ts);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${pad2(m)} ${ampm}`;
  };

  const timerDisplay = formatHMS(elapsedMs);
  const sessionLabel = formatHM(elapsedMs);
  // "Started" is derived from the live elapsed total so dragging the slider
  // updates it in real time. (now − elapsed = the implied start clock.)
  const startedLabel = formatClock(Date.now() - elapsedMs);
  const nowLabel = formatClock(Date.now());

  // Progress bar: elapsed fraction of an 8-hour workday, capped at 100%.
  const progressPct = Math.min(100, (elapsedMs / (8 * 60 * 60 * 1000)) * 100);

  const statusLabel = isPaused ? 'Paused' : 'Active';

  const theme = THEME[selectedColor];
  const currentIcon = ICON_PATHS[selectedIcon];

  // Inline CSS custom properties so preview.css rules (slider thumb,
  // selected work chip, etc.) can inherit the active panel color.
  const accentVars = {
    '--accent': theme.accent,
    '--accent-soft': theme.accentSoft,
    '--accent-border': theme.accentBorder,
    '--accent-text': theme.accentText,
  } as React.CSSProperties;

  return (
    <>
      {/* ==================== MOBILE ==================== */}
      <div className="md:hidden flex flex-col h-screen overflow-hidden bg-white" style={accentVars}>
        <header className={`px-4 py-3 border-b ${theme.headerBorder} ${theme.headerBg} flex items-center gap-3 shrink-0`}>
          <button onClick={goHome} className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 shrink-0" title="Back">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="relative group shrink-0">
            <div className={`w-9 h-9 rounded-xl ${theme.iconBg} border ${theme.iconBorder} flex items-center justify-center ${theme.iconText}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {currentIcon}
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`w-1 h-6 rounded-full ${theme.bar} shrink-0`}></div>
            <h1 className="text-base font-bold text-slate-900 truncate">{panel.name}</h1>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`${isPaused ? '' : 'timer-pulse '}block w-1.5 h-1.5 rounded-full ${theme.dot}`}></span>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${theme.text}`}>{statusLabel}</span>
            </div>
          </div>
          <span className="text-xl font-mono font-extrabold text-slate-900 tabular-nums tracking-tight shrink-0">{timerDisplay}</span>
        </header>

        <div className="flex-1 overflow-auto hide-scrollbar px-4 py-5 space-y-5">
          {/* Primary Actions */}
          <div className="flex gap-2.5">
            <button
              onClick={togglePause}
              className={`flex-1 font-semibold rounded-2xl flex items-center justify-center gap-2 text-sm border transition-colors ${
                isPaused
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
              style={{ height: 52 }}
            >
              {isPaused ? (
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              )}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          </div>

          {/* Time Controls */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Session Time</h2>
              <span className="text-sm font-mono font-semibold text-slate-600 tabular-nums">{sessionLabel}</span>
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-500">Started</span>
                <span className="text-sm font-semibold text-slate-700">{startedLabel}</span>
              </div>
              <input
                type="range"
                min={0}
                max={SLIDER_MAX_MIN}
                step={1}
                value={elapsedMin}
                onChange={onSlideElapsed}
                className="time-slider"
                aria-label="Adjust session time"
              />
              <div className="flex justify-between text-[9px] text-slate-300 mt-1">
                <span>0h</span><span>2h</span><span>4h</span><span>6h</span><span>8h</span>
              </div>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full ${theme.progress} rounded-full`} style={{ width: `${progressPct}%` }}></div>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[9px] text-slate-400">{startedLabel}</span>
              <span className={`text-[9px] font-medium ${theme.text}`}>Now — {nowLabel}</span>
            </div>
          </div>

          {/* Project */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">Project</label>
            <ProjectPicker
              value={projectId}
              onChange={p => setProjectId(p.id)}
              size="sm"
            />
          </div>

          {/* Focus Note */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">What are you working on?</label>
            <input
              type="text"
              placeholder="e.g., Landing page copy"
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-300"
              value={focusNote}
              onChange={(e) => setFocusNote(e.target.value)}
            />
          </div>

          {/* Work Type */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">Work Type</label>
            <div className="flex flex-wrap gap-1.5">
              {WORK_TYPES.map((type) => (
                <span
                  key={type}
                  className={`work-chip px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer${selectedWorkType === type ? ' selected' : ' border-slate-200 bg-white text-slate-500'}`}
                  onClick={() => setSelectedWorkType(type)}
                >
                  {type}
                </span>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">Tags</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {tags.map(t => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-medium text-slate-600"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label={`Remove ${t}`}
                  >
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              {showTagInput ? (
                <input
                  autoFocus
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onBlur={() => { if (tagDraft.trim()) addTag(tagDraft); else setShowTagInput(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addTag(tagDraft); }
                    else if (e.key === 'Escape') { setTagDraft(''); setShowTagInput(false); }
                  }}
                  placeholder="tag"
                  className="px-2 py-1 rounded-lg border border-dashed border-slate-300 text-[11px] font-medium text-slate-600 bg-white w-20 outline-none focus:border-slate-400"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTagInput(true)}
                  className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg border border-dashed border-slate-200 text-[11px] font-medium text-slate-400 hover:text-slate-600 hover:border-slate-300"
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 6v12m6-6H6" />
                  </svg>
                  Add
                </button>
              )}
            </div>
          </div>

          {/* Session State */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">Session State</label>
            <div className="flex gap-1.5">
              {SESSION_STATES.map((state) => (
                <button
                  key={state.id}
                  type="button"
                  onClick={() => toggleSessionState(state.id)}
                  className={`state-toggle flex-1 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer${
                    sessionState === state.id
                      ? ' on'
                      : ' border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  {state.icon}
                  {state.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Notes <span className="font-normal normal-case text-slate-300">optional</span>
            </label>
            <textarea
              rows={2}
              placeholder="Quick notes..."
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>
          </div>

          {/* Customize Panel (collapsed) */}
          <details className="group">
            <summary className="flex items-center gap-1.5 cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:text-slate-400 list-none">
              <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M9 5l7 7-7 7" />
              </svg>
              Customize Panel
            </summary>
            <div className="mt-3 bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3">
              {/* Color picker */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">Color</label>
                <div className="flex items-center gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      aria-label={color.name}
                      className={`color-opt w-7 h-7 rounded-full ${color.bg}${selectedColor === color.name ? ' selected' : ''}`}
                      onClick={() => setSelectedColor(color.name)}
                    />
                  ))}
                </div>
              </div>
              {/* Icon picker */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">Icon</label>
                <div className="flex items-center gap-1.5">
                  {ICON_PATHS.map((iconPath, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`icon-opt w-9 h-9 rounded-xl border flex items-center justify-center${selectedIcon === idx ? ' selected' : ''}`}
                      onClick={() => setSelectedIcon(idx)}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {iconPath}
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </details>

          <div className="h-4"></div>
        </div>
      </div>

      {/* ==================== DESKTOP ==================== */}
      <div className="hidden md:flex h-screen overflow-hidden bg-white" style={accentVars}>
        <div className="flex-1 flex flex-col">
          <header className={`px-6 py-4 border-b ${theme.headerBorder} ${theme.headerBg} flex items-center gap-4 shrink-0`}>
            <button onClick={goHome} className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors shrink-0" title="Back to Home">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative group">
                <div className={`w-10 h-10 rounded-xl ${theme.iconBg} border ${theme.iconBorder} flex items-center justify-center ${theme.iconText} cursor-pointer ${theme.iconHoverBorder} transition-colors`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {currentIcon}
                  </svg>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-2 h-2 text-slate-400" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168l10-10z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-1 h-8 rounded-full ${theme.bar} shrink-0`}></div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-slate-900 truncate">{panel.name}</h1>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`${isPaused ? '' : 'timer-pulse '}block w-2 h-2 rounded-full ${theme.dot}`}></span>
                <span className={`text-xs font-bold uppercase tracking-wider ${theme.text}`}>{statusLabel}</span>
              </div>
            </div>
            <div className="shrink-0">
              <span className="text-3xl font-mono font-extrabold text-slate-900 tabular-nums tracking-tight">{timerDisplay}</span>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            <div className="max-w-2xl mx-auto px-8 py-8 space-y-8">
              {/* Primary Actions */}
              <div className="flex gap-3">
                <button
                  onClick={togglePause}
                  className={`flex-1 font-semibold rounded-2xl flex items-center justify-center gap-2 text-base border transition-colors ${
                    isPaused
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}
                  style={{ height: 56 }}
                >
                  {isPaused ? (
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  )}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
              </div>

              {/* Time Controls */}
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Session Time</h2>
                  <span className="text-sm font-mono font-semibold text-slate-600 tabular-nums">{sessionLabel}</span>
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-slate-500">Started</span>
                    <span className="text-sm font-semibold text-slate-700">{startedLabel}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={SLIDER_MAX_MIN}
                    step={1}
                    value={elapsedMin}
                    onChange={onSlideElapsed}
                    className="time-slider"
                    aria-label="Adjust session time"
                  />
                  <div className="flex justify-between text-[9px] text-slate-300 mt-1">
                    <span>0h</span><span>2h</span><span>4h</span><span>6h</span><span>8h</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full ${theme.progress} rounded-full`} style={{ width: `${progressPct}%` }}></div>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[9px] text-slate-400">{startedLabel}</span>
                  <span className={`text-[9px] font-medium ${theme.text}`}>Now — {nowLabel}</span>
                </div>
              </div>

              {/* Work Context */}
              <div className="space-y-5">
                {/* Project */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">Project</label>
                  <ProjectPicker
                    value={projectId}
                    onChange={p => setProjectId(p.id)}
                    size="md"
                  />
                </div>

                {/* Focus Note */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">What are you working on?</label>
                  <input
                    type="text"
                    placeholder="e.g., Landing page copy"
                    className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-300"
                    value={focusNote}
                    onChange={(e) => setFocusNote(e.target.value)}
                  />
                </div>

                {/* Work Type */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">Work Type</label>
                  <div className="flex flex-wrap gap-2">
                    {WORK_TYPES.map((type) => (
                      <span
                        key={type}
                        className={`work-chip px-3.5 py-2 rounded-xl border text-xs font-medium cursor-pointer${selectedWorkType === type ? ' selected' : ' border-slate-200 bg-white text-slate-500'}`}
                        onClick={() => setSelectedWorkType(type)}
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">Tags</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {tags.map(t => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-[11px] font-medium text-slate-600"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => removeTag(t)}
                          className="text-slate-400 hover:text-slate-600"
                          aria-label={`Remove ${t}`}
                        >
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                    {showTagInput ? (
                      <input
                        autoFocus
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onBlur={() => { if (tagDraft.trim()) addTag(tagDraft); else setShowTagInput(false); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); addTag(tagDraft); }
                          else if (e.key === 'Escape') { setTagDraft(''); setShowTagInput(false); }
                        }}
                        placeholder="tag"
                        className="px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 text-[11px] font-medium text-slate-600 bg-white w-24 outline-none focus:border-slate-400"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowTagInput(true)}
                        className="inline-flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-200 text-[11px] font-medium text-slate-400 hover:text-slate-600 hover:border-slate-300"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path d="M12 6v12m6-6H6" />
                        </svg>
                        Add
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Session State */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">Session State</label>
                <div className="flex gap-1.5">
                  {SESSION_STATES.map((state) => (
                    <button
                      key={state.id}
                      type="button"
                      onClick={() => toggleSessionState(state.id)}
                      className={`state-toggle px-4 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer${
                        sessionState === state.id
                          ? ' on'
                          : ' border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      {state.icon}
                      {state.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Notes <span className="font-normal normal-case text-slate-300">optional</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Quick notes..."
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 resize-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                ></textarea>
              </div>

              {/* Customize Panel (collapsed) */}
              <details className="group">
                <summary className="flex items-center gap-1.5 cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:text-slate-400 list-none">
                  <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                  Customize Panel
                </summary>
                <div className="mt-3 bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3">
                  {/* Color picker */}
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">Color</label>
                    <div className="flex items-center gap-2">
                      {COLORS.map((color) => (
                        <button
                          key={color.name}
                          type="button"
                          aria-label={color.name}
                          className={`color-opt w-7 h-7 rounded-full ${color.bg}${selectedColor === color.name ? ' selected' : ''}`}
                          onClick={() => setSelectedColor(color.name)}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Icon picker */}
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">Icon</label>
                    <div className="flex items-center gap-1.5">
                      {ICON_PATHS.map((iconPath, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`icon-opt w-9 h-9 rounded-xl border flex items-center justify-center${selectedIcon === idx ? ' selected' : ''}`}
                          onClick={() => setSelectedIcon(idx)}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            {iconPath}
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </details>

              <div className="h-4"></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default FullscreenPanelScreen;
