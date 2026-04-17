// ============================================================
// Pick Panel Screen — fullscreen picker shown after the user
// clicks "Start Panel" / "Switch Panel" on Home. Picking a panel
// immediately opens that panel fullscreen.
//
// Also the place where users add new panels (with a color) and
// prune panels they no longer need. The catalog lives in
// NavContext + localStorage, so changes here persist across reloads.
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNav } from '../../lib/previewNav';
import {
  PANEL_COLOR_OPTIONS,
  type MockPanel,
} from '../../lib/panelCatalog';

// ---- Small time formatters local to this screen ----
const pad2 = (n: number) => n.toString().padStart(2, '0');
const formatHM = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h === 0 ? `${m}m` : `${h}h ${pad2(m)}m`;
};

const Logo: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <circle cx="10" cy="10" r="5" fill="#3b82f6" />
    <circle cx="22" cy="10" r="5" fill="#f97316" />
    <circle cx="10" cy="22" r="5" fill="#8b5cf6" />
    <circle cx="22" cy="22" r="5" fill="#10b981" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
  </svg>
);

// Meeting card icon — two people silhouettes so "Meeting" reads at a
// glance even without the label. Intentionally distinct from the panel
// color dots so users can eye-scan this action apart from the catalog.
const MeetingIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

// Commute card icon — a car icon to visually distinguish commute from
// work panels and meetings.
const CommuteIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v7a2 2 0 01-2 2h-2" />
    <circle cx="7" cy="17" r="2" />
    <circle cx="17" cy="17" r="2" />
    <path d="M9 3v5h8" />
  </svg>
);

// ---- Inline "New Panel" form ----
// Kept as a top-level component so it never re-mounts on every
// keystroke in the parent — otherwise the name input would lose
// focus between characters.
type NewPanelFormProps = {
  onCreate: (name: string, colorId: string) => void;
  onCancel: () => void;
  compact?: boolean;
};

const NewPanelForm: React.FC<NewPanelFormProps> = ({ onCreate, onCancel, compact }) => {
  const [name, setName] = useState('');
  const [colorId, setColorId] = useState<string>(PANEL_COLOR_OPTIONS[0].id);

  const submit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, colorId);
  };

  return (
    <form
      onSubmit={submit}
      className={`w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500">
          <PlusIcon className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700">New Panel</h3>
      </div>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Panel name (e.g. Client Onboarding)"
        autoFocus
        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300"
      />
      <div className="mt-3">
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">Color</p>
        <div className="flex flex-wrap gap-2">
          {PANEL_COLOR_OPTIONS.map(opt => {
            const selected = opt.id === colorId;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setColorId(opt.id)}
                title={opt.label}
                className={`w-7 h-7 rounded-full ${opt.barClass} transition-all ${
                  selected ? 'ring-2 ring-offset-2 ring-slate-700 scale-110' : 'opacity-80 hover:opacity-100'
                }`}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 px-4 text-sm font-medium text-slate-500 rounded-xl hover:bg-slate-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={name.trim().length === 0}
          className="h-9 px-4 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Create Panel
        </button>
      </div>
    </form>
  );
};

export const PickPanelScreen: React.FC = () => {
  const {
    navigate,
    panelCatalog,
    removePanel,
    restorePanel,
    createPanelInstance,
    createPanelAndStart,
    createMeetingInstance,
    createCommuteInstance,
    panels,
    panelAccum,
    activeTimer,
    preferences,
  } = useNav();

  const [creating, setCreating] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const activeCatalog = panelCatalog.filter(p => p.status !== 'archived');
  const archivedCatalog = panelCatalog.filter(p => p.status === 'archived');

  // Tick every second so the live "Active · 1h 22m" counter updates
  // while the user is on this screen.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activeTimer) return;
    const id = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [activeTimer]);

  // Sum of tracked time across every live instance of this catalog type today.
  // Types are templates — the user may have several cards running off the same
  // template — so the Pick screen rolls them up per type.
  const typeTotalMs = (typeId: string): number => {
    let total = 0;
    for (const p of panels) {
      if (p.typeId !== typeId) continue;
      total += panelAccum[p.id] ?? 0;
    }
    return total;
  };

  const typeInstanceCount = (typeId: string): number =>
    panels.filter(p => p.typeId === typeId && p.status === 'active').length;

  const typeHasRunning = (typeId: string): boolean => {
    if (!activeTimer) return false;
    const active = panels.find(p => p.id === activeTimer.panelId);
    return !!active && active.typeId === typeId;
  };

  // Status pill under each row.
  //   'running' — an instance of this type is the live timer right now
  //   'tracked' — instances exist and have time on the clock today
  //   'live'    — instances exist but no tracked time yet
  //   null      — no instances yet
  type RowStatus = 'running' | 'tracked' | 'live' | null;
  const statusFor = (typeId: string): RowStatus => {
    if (typeHasRunning(typeId)) return 'running';
    if (typeTotalMs(typeId) > 0) return 'tracked';
    if (typeInstanceCount(typeId) > 0) return 'live';
    return null;
  };

  // Tapping a catalog type creates a fresh Panel instance and starts it.
  // Same type picked twice → two separate instances on Home, independent
  // clocks, independent project/workType/focusNote.
  const pick = (type: MockPanel) => {
    const instance = createPanelInstance(type.id);
    if (!instance) return;
    navigate('panel', { panelId: instance.id });
  };

  // Start Meeting: one-shot session type (see PanelKind doc in
  // panelCatalog.ts). Skips the catalog entirely — meetings don't have
  // templates — and lands directly in the Fullscreen meeting variant
  // so the user can pick Planned/Impromptu + audience + project + topic.
  const startMeeting = () => {
    const instance = createMeetingInstance();
    navigate('panel', { panelId: instance.id });
  };

  // Start Commute: one-shot session type, like meetings but for travel.
  const startCommute = () => {
    const instance = createCommuteInstance();
    navigate('panel', { panelId: instance.id });
  };

  const handleCreate = (name: string, colorId: string) => {
    // createPanelAndStart does both steps atomically — avoids the
    // stale-state race of calling createPanel (async setState) then
    // createPanelInstance (reads not-yet-updated catalog).
    setCreating(false);
    const instance = createPanelAndStart({ name, colorId });
    navigate('panel', { panelId: instance.id });
  };

  const handleRemove = (id: string) => {
    removePanel(id);
    setConfirmRemoveId(null);
  };

  const goHome = () => navigate('home');

  return (
    <>
      {/* ==================== DESKTOP ==================== */}
      <div className="hidden md:flex h-screen bg-white flex-col overflow-hidden">
        {/* Header */}
        <header className="px-8 py-5 border-b border-slate-100 flex items-center gap-4 shrink-0">
          <Logo size={28} />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">Pick a Panel</h1>
            <p className="text-sm text-slate-400">Choose what you're working on</p>
          </div>
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="h-9 px-4 text-sm font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <PlusIcon className="w-4 h-4" />
              New Panel
            </button>
          )}
          <button
            onClick={goHome}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors shrink-0"
            title="Close"
          >
            <CloseIcon />
          </button>
        </header>

        {/* Panel grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[720px] mx-auto px-8 py-10 space-y-3">
            {creating && (
              <NewPanelForm
                onCreate={handleCreate}
                onCancel={() => setCreating(false)}
              />
            )}

            {/* Start a Meeting — meetings are a distinct session type,
                not a catalog template. Rendered above the catalog so
                it reads as a peer entry point rather than "just another
                panel," and so the user can jump straight into a meeting
                session without naming it first. */}
            {!creating && (
              <button
                type="button"
                onClick={startMeeting}
                className="w-full bg-white rounded-2xl border border-dashed border-slate-300 p-5 flex items-center gap-4 hover:border-slate-400 hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors shrink-0">
                  <MeetingIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Start a Meeting</h3>
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Session type</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">Planned or impromptu — tracked separately in reports</p>
                </div>
                <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Start a Commute — shown only when enabled in preferences */}
            {!creating && preferences.showCommute && (
              <button
                type="button"
                onClick={startCommute}
                className="w-full bg-white rounded-2xl border border-dashed border-orange-200 p-5 flex items-center gap-4 hover:border-orange-300 hover:bg-orange-50 transition-colors text-left group"
              >
                <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 group-hover:bg-orange-100 transition-colors shrink-0">
                  <CommuteIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Start Commute</h3>
                    <span className="px-1.5 py-0.5 rounded-md bg-orange-50 text-[10px] font-semibold uppercase tracking-wider text-orange-500">Session type</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">Track travel time — tracked separately in reports</p>
                </div>
                <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {activeCatalog.length === 0 && !creating && (
              <div className="py-10 text-center">
                <h2 className="text-lg font-bold text-slate-700 mb-1.5">No panels yet</h2>
                <p className="text-sm text-slate-400 mb-4">
                  Create your first panel to start tracking time.
                </p>
                <button
                  onClick={() => setCreating(true)}
                  className="h-10 px-5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
                >
                  <PlusIcon className="w-4 h-4" />
                  New Panel
                </button>
              </div>
            )}

            {activeCatalog.map(panel => {
              const isConfirming = confirmRemoveId === panel.id;
              const status = statusFor(panel.id);
              const totalMs = typeTotalMs(panel.id);
              const instanceCount = typeInstanceCount(panel.id);
              return (
                <div
                  key={panel.id}
                  className={`relative panel-card ${panel.bgClass} rounded-2xl border ${panel.borderClass} p-5 flex items-center gap-4 hover:shadow-md transition-shadow`}
                >
                  <button
                    type="button"
                    onClick={() => pick(panel)}
                    className="flex-1 flex items-center gap-4 text-left min-w-0"
                  >
                    <div className={`w-2 h-14 rounded-full ${panel.barClass} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900 truncate">{panel.name}</h3>
                        {status === 'running' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                            <span className="timer-pulse block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                        {status === 'live' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {instanceCount} live
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {instanceCount > 0 ? `${instanceCount} card${instanceCount === 1 ? '' : 's'}` : 'Pick to start'}
                        {totalMs > 0 && (
                          <span className={`ml-2 tabular-nums font-mono ${status === 'running' ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                            · {formatHM(totalMs)} today
                          </span>
                        )}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {isConfirming ? (
                    <div className="flex items-center gap-2 shrink-0 pl-2">
                      <span className="text-xs font-medium text-slate-600">Archive?</span>
                      <button
                        type="button"
                        onClick={() => handleRemove(panel.id)}
                        className="h-8 px-3 bg-slate-700 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(null)}
                        className="h-8 px-3 text-xs font-medium text-slate-500 rounded-lg hover:bg-white/60 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveId(panel.id)}
                      title="Archive panel"
                      className="shrink-0 w-9 h-9 rounded-xl text-slate-400 hover:bg-white/60 hover:text-slate-600 transition-colors flex items-center justify-center"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Archived panels — collapsible section at the bottom */}
            {archivedCatalog.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setArchivedOpen(o => !o)}
                  className="w-full flex items-center gap-2 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${archivedOpen ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                  Archived Panels ({archivedCatalog.length})
                </button>
                {archivedOpen && (
                  <div className="space-y-2 mt-2">
                    {archivedCatalog.map(panel => (
                      <div
                        key={panel.id}
                        className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex items-center gap-4 opacity-60"
                      >
                        <div className={`w-2 h-10 rounded-full ${panel.barClass} shrink-0`} />
                        <p className="flex-1 text-sm font-semibold text-slate-600 truncate">{panel.name}</p>
                        <button
                          type="button"
                          onClick={() => restorePanel(panel.id)}
                          className="h-8 px-3 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-white transition-colors shrink-0"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== MOBILE ==================== */}
      <div className="md:hidden flex flex-col h-screen bg-white overflow-hidden">
        {/* Header */}
        <header className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
          <Logo size={24} />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900">Pick a Panel</h1>
            <p className="text-[11px] text-slate-400">Choose what you're working on</p>
          </div>
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              title="New panel"
              className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 shrink-0"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={goHome}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 shrink-0"
            title="Close"
          >
            <CloseIcon />
          </button>
        </header>

        {/* Panel list */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
          {creating && (
            <NewPanelForm
              onCreate={handleCreate}
              onCancel={() => setCreating(false)}
              compact
            />
          )}

          {/* Start a Meeting — mobile variant. Matches the desktop card
              in intent but compacted so it doesn't eat the viewport. */}
          {!creating && (
            <button
              type="button"
              onClick={startMeeting}
              className="w-full bg-white rounded-2xl border border-dashed border-slate-300 p-4 flex items-center gap-3 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                <MeetingIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-slate-900">Start a Meeting</h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">Planned or impromptu — tracked separately</p>
              </div>
              <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Start a Commute — mobile variant, shown only when enabled */}
          {!creating && preferences.showCommute && (
            <button
              type="button"
              onClick={startCommute}
              className="w-full bg-white rounded-2xl border border-dashed border-orange-200 p-4 flex items-center gap-3 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shrink-0">
                <CommuteIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-slate-900">Start Commute</h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">Track travel time — tracked separately</p>
              </div>
              <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {activeCatalog.length === 0 && !creating && (
            <div className="py-8 text-center">
              <h2 className="text-base font-bold text-slate-700 mb-1.5">No panels yet</h2>
              <p className="text-xs text-slate-400 mb-4">
                Create your first panel to start tracking time.
              </p>
              <button
                onClick={() => setCreating(true)}
                className="h-10 px-5 bg-slate-900 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-1.5"
              >
                <PlusIcon className="w-4 h-4" />
                New Panel
              </button>
            </div>
          )}

          {activeCatalog.map(panel => {
            const isConfirming = confirmRemoveId === panel.id;
            const status = statusFor(panel.id);
            const totalMs = typeTotalMs(panel.id);
            const instanceCount = typeInstanceCount(panel.id);
            return (
              <div
                key={panel.id}
                className={`relative panel-card ${panel.bgClass} rounded-2xl border ${panel.borderClass} p-4 flex items-center gap-3`}
              >
                <button
                  type="button"
                  onClick={() => pick(panel)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  <div className={`w-1.5 h-12 rounded-full ${panel.barClass} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-bold text-slate-900 truncate">{panel.name}</h3>
                      {status === 'running' && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 shrink-0">
                          <span className="timer-pulse block w-1 h-1 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {instanceCount > 0 ? `${instanceCount} card${instanceCount === 1 ? '' : 's'}` : 'Pick to start'}
                      {totalMs > 0 && (
                        <span className={`ml-1.5 tabular-nums font-mono ${status === 'running' ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                          · {formatHM(totalMs)}
                        </span>
                      )}
                    </p>
                  </div>
                </button>
                {isConfirming ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRemove(panel.id)}
                      className="h-8 px-2.5 bg-slate-700 text-white text-[11px] font-semibold rounded-lg"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveId(null)}
                      className="h-8 px-2 text-[11px] font-medium text-slate-500 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveId(panel.id)}
                    title="Archive panel"
                    className="shrink-0 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Archived panels — collapsible section at the bottom */}
          {archivedCatalog.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setArchivedOpen(o => !o)}
                className="w-full flex items-center gap-2 py-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${archivedOpen ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
                Archived ({archivedCatalog.length})
              </button>
              {archivedOpen && (
                <div className="space-y-2 mt-1">
                  {archivedCatalog.map(panel => (
                    <div
                      key={panel.id}
                      className="bg-slate-50 rounded-2xl border border-slate-200 p-3 flex items-center gap-3 opacity-60"
                    >
                      <div className={`w-1.5 h-8 rounded-full ${panel.barClass} shrink-0`} />
                      <p className="flex-1 text-sm font-semibold text-slate-600 truncate">{panel.name}</p>
                      <button
                        type="button"
                        onClick={() => restorePanel(panel.id)}
                        className="h-7 px-2.5 text-[11px] font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-white transition-colors shrink-0"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PickPanelScreen;
