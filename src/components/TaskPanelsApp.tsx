// ============================================================
// TaskPanelsApp — the shared V6 application shell
// Used by both the real app (src/App.tsx) and the standalone
// preview entry (src/preview.tsx). Owns all the local state
// (catalog, panels, runs, timers, breaks, projects, profile,
// summary) via NavProvider. Persistence is localStorage.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { FullscreenPanelScreen } from './screens/FullscreenPanelScreen';
import { PrepareSummaryScreen } from './screens/PrepareSummaryScreen';
import { DailyWorkSummaryScreen } from './screens/DailyWorkSummaryScreen';
import { PerformanceReviewScreen } from './screens/PerformanceReviewScreen';
import { SummaryArchiveScreen } from './screens/SummaryArchiveScreen';
import { TeamGateScreen } from './screens/TeamGateScreen';
import { PickPanelScreen } from './screens/PickPanelScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { AvatarBadge } from './AvatarBadge';
import {
  NavProvider,
  type PreviewScreen,
  type NavigateOptions,
  type ActiveTimer,
  type ActiveBreak,
  type BreakKind,
} from '../lib/previewNav';
import type { SummaryInput } from '../lib/summaryModel';
import {
  loadSavedSummaries,
  saveSavedSummaries,
  keyForSummary,
} from '../lib/savedSummaries';
import {
  loadCatalog,
  saveCatalog,
  loadPanels,
  savePanels,
  loadRuns,
  saveRuns,
  makePanel,
  makePanelFromType,
  makeMeetingPanel,
  makeRun,
  BREAK_PANEL_ID,
  LUNCH_PANEL_ID,
  type MockPanel,
  type Panel,
  type Run,
} from '../lib/panelCatalog';
import { loadOnboarding } from '../lib/onboarding';
import {
  loadProjects,
  saveProjects,
  makeProject,
  type Project,
} from '../lib/projects';
import {
  loadProfile,
  saveProfile,
  type AuthProvider,
  type UserProfile,
} from '../lib/profile';
import {
  loadBreakDurations,
  saveBreakDurations,
  clampBreakMs,
  type BreakDurationsMs,
} from '../lib/breakDefaults';
import { useNotificationScheduler } from '../hooks/useNotificationScheduler';
import {
  loadPreferences,
  savePreferences,
  type AppPreferences,
} from '../lib/preferences';

/** Minimal identity shape the shell cares about. App.tsx pulls this
 *  from Supabase's `user` object; preview.tsx leaves it undefined. */
export interface TaskPanelsAuthUser {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  provider: AuthProvider;
}

interface TaskPanelsAppProps {
  /** Optional signed-in identity. When present, the shell hydrates
   *  userProfile's email/name/ssoAvatarUrl/authProvider from it on
   *  mount and whenever those primitive values change. Preserves any
   *  user-edited name and any uploaded avatarDataUrl. */
  authUser?: TaskPanelsAuthUser | null;
}

// Break/lunch defaults now live in lib/breakDefaults.ts so the user
// can edit them from Settings → Preferences. This file used to have
// DEFAULT_BREAK_MS / DEFAULT_LUNCH_MS constants — removed in favor of
// the persisted state below.

const VALID_SCREENS: PreviewScreen[] = [
  'onboarding',
  'home',
  'panel',
  'pick-panel',
  'prepare-summary',
  'daily-summary',
  'performance-review',
  'summary-archive',
  'team',
  'profile',
  'settings',
  'settings-projects',
  'settings-panels',
  'settings-advanced-labels',
  'settings-breaks',
  'settings-appearance',
  'settings-day-view',
  'settings-notifications',
];

/** Determine initial screen: if no onboarding result exists and no explicit
 *  screen param is set, drop the user into onboarding. */
const initialScreen = (): PreviewScreen => {
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get('screen');
  if (explicit && (VALID_SCREENS as string[]).includes(explicit)) {
    return explicit as PreviewScreen;
  }
  // First-time user → onboarding
  return loadOnboarding() ? 'home' : 'onboarding';
};

const parseScreen = (search: string): PreviewScreen => {
  const params = new URLSearchParams(search);
  const s = params.get('screen');
  return (VALID_SCREENS as string[]).includes(s || '')
    ? (s as PreviewScreen)
    : 'home';
};

export const TaskPanelsApp: React.FC<TaskPanelsAppProps> = ({ authUser }) => {
  const [screen, setScreen] = useState<PreviewScreen>(initialScreen);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);

  // ---- Catalog (PanelTypes — the templates PickPanel lists) ----
  const [panelCatalog, setPanelCatalog] = useState<MockPanel[]>(() => loadCatalog());
  useEffect(() => {
    saveCatalog(panelCatalog);
  }, [panelCatalog]);

  // ---- Live Panel instances (what Home renders) ----
  const [panels, setPanels] = useState<Panel[]>(() => loadPanels());
  useEffect(() => {
    savePanels(panels);
  }, [panels]);

  // ---- Projects (first-class workflow + reporting object) ----
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  // ---- User profile ("My account" — name, avatar, role, etc.) ----
  const [userProfile, setUserProfile] = useState<UserProfile>(() => loadProfile());
  useEffect(() => {
    saveProfile(userProfile);
  }, [userProfile]);
  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setUserProfile(prev => ({ ...prev, ...patch }));
  }, []);

  // Hydrate profile from the authenticated Supabase user.
  // Rules:
  //   - email          → always overwrite (auth is the source of truth)
  //   - name           → keep user-edited value if non-empty, else use SSO
  //   - ssoAvatarUrl   → always refresh (Google photo may have changed)
  //   - authProvider   → always reflect current session
  //   - avatarDataUrl  → preserve (user's uploaded photo always wins)
  //   - role / defaultAudience → preserve (user-owned prefs)
  // Depends on primitive values so a new authUser object reference
  // without changed fields does not re-trigger the effect.
  const authEmail = authUser?.email ?? null;
  const authName = authUser?.name ?? null;
  const authAvatar = authUser?.avatarUrl ?? null;
  const authProvider = authUser?.provider ?? null;
  useEffect(() => {
    if (!authUser) return;
    setUserProfile(prev => {
      const nextEmail = authEmail ?? prev.email;
      const nextName = prev.name.trim() ? prev.name : (authName ?? '');
      const nextSso = authAvatar;
      const nextProvider = authProvider ?? prev.authProvider;
      if (
        prev.email === nextEmail &&
        prev.name === nextName &&
        prev.ssoAvatarUrl === nextSso &&
        prev.authProvider === nextProvider
      ) {
        return prev; // no change → React bails out, no re-render
      }
      return {
        ...prev,
        email: nextEmail,
        name: nextName,
        ssoAvatarUrl: nextSso,
        authProvider: nextProvider,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authEmail, authName, authAvatar, authProvider]);

  // ---- Runs (append-only tracked segments) ----
  const [runs, setRuns] = useState<Run[]>(() => loadRuns());
  useEffect(() => {
    saveRuns(runs);
  }, [runs]);
  const appendRun = useCallback((panelId: string, startedAt: number, endedAt: number) => {
    if (endedAt <= startedAt) return;
    setRuns(prev => [...prev, makeRun(panelId, startedAt, endedAt)]);
  }, []);

  // ---- Active timer ----
  // panelId here is always a Panel *instance* id (or a sentinel for breaks).
  const [activeTimer, setActiveTimer] = useState<ActiveTimer>(null);
  const activeTimerRef = useRef<ActiveTimer>(null);
  useEffect(() => {
    activeTimerRef.current = activeTimer;
  }, [activeTimer]);

  // Derived accumulator: walks runs[] summing ms per panel instance, then
  // adds the in-flight active run. Home and Fullscreen read this.
  const panelAccum = useMemo<Record<string, number>>(() => {
    const acc: Record<string, number> = {};
    for (const r of runs) {
      acc[r.panelId] = (acc[r.panelId] ?? 0) + (r.endedAt - r.startedAt);
    }
    if (activeTimer) {
      acc[activeTimer.panelId] =
        (acc[activeTimer.panelId] ?? 0) + (Date.now() - activeTimer.startedAt);
    }
    return acc;
    // activeTimer.startedAt changes only on start; the live tick is handled
    // by consuming screens (they setInterval and re-render).
  }, [runs, activeTimer]);

  // ---- Break / Lunch countdown ----
  const [activeBreak, setActiveBreak] = useState<ActiveBreak>(null);
  const activeBreakRef = useRef<ActiveBreak>(null);
  useEffect(() => {
    activeBreakRef.current = activeBreak;
  }, [activeBreak]);

  // Break time is stored in `runs` too, keyed by BREAK/LUNCH_PANEL_ID,
  // but HomeScreen still wants a fast "total break accumulated" rollup.
  const breakAccum = useMemo<Record<BreakKind, number>>(() => {
    const acc: Record<BreakKind, number> = { break: 0, lunch: 0 };
    for (const r of runs) {
      if (r.panelId === BREAK_PANEL_ID) acc.break += r.endedAt - r.startedAt;
      else if (r.panelId === LUNCH_PANEL_ID) acc.lunch += r.endedAt - r.startedAt;
    }
    if (activeBreak) {
      const elapsed = Math.min(
        activeBreak.durationMs,
        Math.max(0, Date.now() - activeBreak.startedAt),
      );
      acc[activeBreak.kind] += elapsed;
    }
    return acc;
  }, [runs, activeBreak]);

  const flushBreakRun = useCallback((brk: ActiveBreak, now: number) => {
    if (!brk) return;
    const endedAt = Math.min(now, brk.startedAt + brk.durationMs);
    const sentinel = brk.kind === 'break' ? BREAK_PANEL_ID : LUNCH_PANEL_ID;
    if (endedAt > brk.startedAt) {
      appendRun(sentinel, brk.startedAt, endedAt);
    }
  }, [appendRun]);

  // Persisted user preference — edited from Settings → Break & Lunch
  // Defaults. Loaded synchronously from localStorage so the first
  // render of Home already shows the user's chosen countdowns; saved
  // on every change via the effect below.
  const [breakDurationsMs, setBreakDurationsMsState] =
    useState<BreakDurationsMs>(() => loadBreakDurations());
  useEffect(() => {
    saveBreakDurations(breakDurationsMs);
  }, [breakDurationsMs]);

  const setBreakDurationMs = useCallback((kind: BreakKind, ms: number) => {
    setBreakDurationsMsState(prev => ({ ...prev, [kind]: clampBreakMs(ms) }));
  }, []);

  // ---- App Preferences (time format, default Home tab, …) ----
  const [preferences, setPreferencesState] =
    useState<AppPreferences>(() => loadPreferences());
  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  const setPreference = useCallback(<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    setPreferencesState(prev => ({ ...prev, [key]: value }));
  }, []);

  // ---- Timer actions ----

  const startPanelTimer = useCallback((panelId: string) => {
    const now = Date.now();
    const prev = activeTimerRef.current;
    // Starting any panel timer dismisses an active break — the user chose
    // to work again, so bank the break's elapsed and don't auto-resume.
    flushBreakRun(activeBreakRef.current, now);
    setActiveBreak(null);
    if (prev && prev.panelId === panelId) return;
    if (prev) {
      appendRun(prev.panelId, prev.startedAt, now);
    }
    setActiveTimer({ panelId, startedAt: now });
  }, [appendRun, flushBreakRun]);

  const stopPanelTimer = useCallback(() => {
    const now = Date.now();
    const prev = activeTimerRef.current;
    if (prev) {
      appendRun(prev.panelId, prev.startedAt, now);
    }
    setActiveTimer(null);
  }, [appendRun]);

  const setPanelElapsed = useCallback((panelId: string, ms: number) => {
    // Override semantics: replace all historical runs for this panel with
    // a single synthetic run of length `ms`, ending "now". If the panel is
    // the active one, restart the in-flight run from now.
    const safe = Math.max(0, Math.floor(ms));
    const now = Date.now();
    setRuns(prev => {
      const kept = prev.filter(r => r.panelId !== panelId);
      if (safe > 0) {
        kept.push(makeRun(panelId, now - safe, now));
      }
      return kept;
    });
    const cur = activeTimerRef.current;
    if (cur && cur.panelId === panelId) {
      setActiveTimer({ panelId, startedAt: now });
    }
  }, []);

  // ---- Break actions ----

  const startBreak = useCallback((kind: BreakKind) => {
    const now = Date.now();
    const current = activeTimerRef.current;
    const resumePanelId = current?.panelId ?? null;
    // Pause the active panel by appending its run.
    if (current) {
      appendRun(current.panelId, current.startedAt, now);
      setActiveTimer(null);
    }
    setActiveBreak(prev => {
      // Toggle off when the same kind is tapped again.
      if (prev && prev.kind === kind) {
        flushBreakRun(prev, now);
        if (prev.resumePanelId) {
          setActiveTimer({ panelId: prev.resumePanelId, startedAt: Date.now() });
        }
        return null;
      }
      // Switching between kinds: bank the old, start the new.
      if (prev) flushBreakRun(prev, now);
      const carriedResume = prev ? prev.resumePanelId : resumePanelId;
      return {
        kind,
        startedAt: now,
        durationMs: breakDurationsMs[kind],
        resumePanelId: carriedResume,
      };
    });
  }, [appendRun, flushBreakRun, breakDurationsMs]);

  const cancelBreak = useCallback(() => {
    setActiveBreak(prev => {
      if (!prev) return null;
      flushBreakRun(prev, Date.now());
      if (prev.resumePanelId) {
        setActiveTimer({ panelId: prev.resumePanelId, startedAt: Date.now() });
      }
      return null;
    });
  }, [flushBreakRun]);

  // Auto-expire the active break.
  useEffect(() => {
    if (!activeBreak) return;
    const remaining = activeBreak.startedAt + activeBreak.durationMs - Date.now();
    const fire = () => {
      flushBreakRun(activeBreak, Date.now());
      const resumeId = activeBreak.resumePanelId;
      setActiveBreak(null);
      if (resumeId) {
        setActiveTimer({ panelId: resumeId, startedAt: Date.now() });
      }
    };
    if (remaining <= 0) {
      fire();
      return;
    }
    const id = window.setTimeout(fire, remaining);
    return () => window.clearTimeout(id);
  }, [activeBreak, flushBreakRun]);

  // ---- Catalog actions ----

  const createPanel = useCallback(
    (input: { name: string; colorId: string }): MockPanel => {
      const trimmed = input.name.trim() || 'Untitled panel';
      const type = makePanel({ name: trimmed, colorId: input.colorId });
      setPanelCatalog(prev => [...prev, type]);
      return type;
    },
    [],
  );

  const removePanel = useCallback((id: string) => {
    setPanelCatalog(prev => prev.filter(p => p.id !== id));
  }, []);

  // ---- Panel instance actions ----

  const createPanelInstance = useCallback((typeId: string): Panel | null => {
    const type = panelCatalog.find(t => t.id === typeId);
    if (!type) return null;
    const instance = makePanelFromType(type);
    setPanels(prev => [...prev, instance]);
    // Start timing immediately — the user picked it, they want it running.
    const now = Date.now();
    const prev = activeTimerRef.current;
    flushBreakRun(activeBreakRef.current, now);
    setActiveBreak(null);
    if (prev) {
      appendRun(prev.panelId, prev.startedAt, now);
    }
    setActiveTimer({ panelId: instance.id, startedAt: now });
    return instance;
  }, [panelCatalog, appendRun, flushBreakRun]);

  // Atomic create-and-start: adds the new type to the catalog AND
  // spins up an instance in the same call. Avoids the stale-closure
  // race that happens when createPanel (async setState) is followed
  // immediately by createPanelInstance (reads not-yet-updated catalog).
  const createPanelAndStart = useCallback(
    (input: { name: string; colorId: string }): Panel => {
      const trimmed = input.name.trim() || 'Untitled panel';
      const type = makePanel({ name: trimmed, colorId: input.colorId });
      setPanelCatalog(prev => [...prev, type]);
      const instance = makePanelFromType(type);
      setPanels(prev => [...prev, instance]);
      const now = Date.now();
      const prev = activeTimerRef.current;
      flushBreakRun(activeBreakRef.current, now);
      setActiveBreak(null);
      if (prev) appendRun(prev.panelId, prev.startedAt, now);
      setActiveTimer({ panelId: instance.id, startedAt: now });
      return instance;
    },
    [appendRun, flushBreakRun],
  );

  // Meetings skip the catalog (they're one-shot, not templates) and
  // go straight to a Panel instance with `kind: 'meeting'`. Same
  // bank-and-switch semantics as createPanelInstance so starting a
  // meeting cleanly stops whatever the user was tracking before.
  const createMeetingInstance = useCallback(
    (input: { name?: string; colorId?: string } = {}): Panel => {
      const instance = makeMeetingPanel(input);
      setPanels(prev => [...prev, instance]);
      const now = Date.now();
      const prev = activeTimerRef.current;
      flushBreakRun(activeBreakRef.current, now);
      setActiveBreak(null);
      if (prev) {
        appendRun(prev.panelId, prev.startedAt, now);
      }
      setActiveTimer({ panelId: instance.id, startedAt: now });
      return instance;
    },
    [appendRun, flushBreakRun],
  );

  const updatePanel = useCallback((id: string, patch: Partial<Panel>) => {
    setPanels(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const deletePanelInstance = useCallback((id: string) => {
    // Stop the timer if this instance is active — bank the elapsed first.
    const cur = activeTimerRef.current;
    if (cur && cur.panelId === id) {
      appendRun(id, cur.startedAt, Date.now());
      setActiveTimer(null);
    }
    setPanels(prev => prev.filter(p => p.id !== id));
    // Runs are kept (historical) so deleted instances don't vanish from
    // past reports — but we mark them orphan by leaving them in place.
  }, [appendRun]);

  // Navigate is declared below; endMyDay needs it, so we forward-ref it.
  const navigateRef = useRef<(s: PreviewScreen, opts?: NavigateOptions) => void>(() => {});

  const endMyDay = useCallback(() => {
    const now = Date.now();
    // Bank active timer and active break.
    const cur = activeTimerRef.current;
    if (cur) {
      appendRun(cur.panelId, cur.startedAt, now);
      setActiveTimer(null);
    }
    flushBreakRun(activeBreakRef.current, now);
    setActiveBreak(null);
    // Mark every active instance as done.
    setPanels(prev => prev.map(p => (p.status === 'active' ? { ...p, status: 'done' } : p)));
    // Land on Prepare Summary so the user can review and generate.
    navigateRef.current('prepare-summary');
  }, [appendRun, flushBreakRun]);

  // ---- Project actions ----

  const createProject = useCallback(
    (input: { name: string; colorId?: string; client?: string; description?: string }): Project => {
      const project = makeProject(input);
      setProjects(prev => [...prev, project]);
      return project;
    },
    [],
  );

  const updateProject = useCallback(
    (id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>) => {
      setProjects(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
    },
    [],
  );

  const archiveProject = useCallback((id: string) => {
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, archived: true } : p)));
  }, []);

  const unarchiveProject = useCallback((id: string) => {
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, archived: false } : p)));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  const touchProject = useCallback((id: string) => {
    const now = Date.now();
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, lastUsedAt: now } : p)));
  }, []);

  // ---- Summary snapshot ----
  const [currentSummary, setCurrentSummary] = useState<SummaryInput | null>(null);

  // ---- Saved summaries archive ----
  // Per-date archive of daily reports the user has generated.
  // Keyed by local ISO date so re-generating the same day
  // overwrites in place. Persisted to localStorage so yesterday's
  // report survives a refresh.
  const [savedSummaries, setSavedSummaries] = useState<Record<string, SummaryInput>>(
    () => loadSavedSummaries(),
  );
  useEffect(() => {
    saveSavedSummaries(savedSummaries);
  }, [savedSummaries]);
  const saveSummary = useCallback((input: SummaryInput) => {
    // Non-daily kinds (performance / weekly / etc.) don't fit the
    // per-day archive — skip them until we have a range-based view.
    if (input.reportKind !== 'daily') return;
    const key = keyForSummary(input);
    setSavedSummaries(prev => ({ ...prev, [key]: input }));
  }, []);
  const deleteSavedSummary = useCallback((iso: string) => {
    setSavedSummaries(prev => {
      if (!(iso in prev)) return prev;
      const next = { ...prev };
      delete next[iso];
      return next;
    });
  }, []);

  // ---- Navigation ----
  const navigate = useCallback((next: PreviewScreen, opts?: NavigateOptions) => {
    if (opts && typeof opts.panelId === 'string') {
      setSelectedPanelId(opts.panelId);
    }
    setScreen(prev => {
      if (prev === next) return prev;
      const url = new URL(window.location.href);
      if (next === 'home') {
        url.searchParams.delete('screen');
      } else {
        url.searchParams.set('screen', next);
      }
      window.history.pushState({ screen: next }, '', url.toString());
      window.scrollTo({ top: 0 });
      return next;
    });
  }, []);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // Back/forward browser buttons
  useEffect(() => {
    const onPop = () => setScreen(parseScreen(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // ---- Notification scheduler ----
  // Fires local notifications for daily reminder, end-of-day prompt,
  // and idle warnings based on the user's notification preferences.
  useNotificationScheduler(preferences, activeTimer);

  const navValue = {
    screen,
    selectedPanelId,
    navigate,
    panelCatalog,
    createPanel,
    removePanel,
    panels,
    createPanelInstance,
    createPanelAndStart,
    createMeetingInstance,
    updatePanel,
    deletePanelInstance,
    endMyDay,
    runs,
    panelAccum,
    activeTimer,
    startPanelTimer,
    stopPanelTimer,
    setPanelElapsed,
    activeBreak,
    breakDurationsMs,
    setBreakDurationMs,
    startBreak,
    cancelBreak,
    breakAccum,
    projects,
    createProject,
    updateProject,
    archiveProject,
    unarchiveProject,
    deleteProject,
    touchProject,
    userProfile,
    updateProfile,
    currentSummary,
    setCurrentSummary,
    savedSummaries,
    saveSummary,
    deleteSavedSummary,
    preferences,
    setPreference,
  };

  // Onboarding — fullscreen, no sidebar/nav, no NavProvider needed
  if (screen === 'onboarding') {
    return (
      <OnboardingScreen
        onComplete={({ roleLabel, audienceLabel }) => {
          // Reload the catalog from localStorage (OnboardingScreen persisted it).
          setPanelCatalog(loadCatalog());
          // Seed the user's profile with the role + audience they picked
          // during onboarding so ProfileScreen isn't mysteriously empty
          // and the daily-summary form pre-fills the right audience. We
          // only write if the user hasn't already filled these fields
          // themselves (e.g. re-onboarding later shouldn't clobber a
          // manually-tuned role).
          updateProfile({
            role: userProfile.role.trim() || roleLabel,
            defaultAudience: userProfile.defaultAudience.trim() || audienceLabel,
          });
          navigate('home');
        }}
      />
    );
  }

  // Fullscreen panel is an immersive overlay — no sidebar or bottom nav
  if (screen === 'panel') {
    return (
      <NavProvider value={navValue}>
        <FullscreenPanelScreen />
      </NavProvider>
    );
  }

  // Pick-panel picker is also fullscreen — no sidebar or bottom nav
  if (screen === 'pick-panel') {
    return (
      <NavProvider value={navValue}>
        <PickPanelScreen />
      </NavProvider>
    );
  }

  // Determine which nav item is active
  const isHome = screen === 'home';
  const isSummary =
    screen === 'prepare-summary' ||
    screen === 'daily-summary' ||
    screen === 'performance-review' ||
    screen === 'summary-archive';
  const isTeam = screen === 'team';
  // startsWith covers the root AND every sub-screen so future
  // settings-* routes don't need to be listed here one by one.
  const isSettings = screen === 'settings' || screen.startsWith('settings-');
  const isProfile = screen === 'profile';

  // Screens that use the AppShell wrapper (sidebar + main + bottom nav).
  // Root uses h-[100dvh] so iOS Safari doesn't clip the bottom nav behind
  // the address/tool bars (100vh extends past the visible viewport there).
  return (
    <NavProvider value={navValue}>
      <div className="flex h-[100dvh] overflow-hidden bg-white">

        {/* ===== Desktop Sidebar ===== */}
        <nav className="hidden md:flex w-16 bg-white border-r border-slate-100 flex-col items-center py-4 shrink-0">
          <div className="mb-6">
            <svg width="28" height="28" viewBox="0 0 32 32">
              <circle cx="10" cy="10" r="5" fill="#3b82f6" />
              <circle cx="22" cy="10" r="5" fill="#f97316" />
              <circle cx="10" cy="22" r="5" fill="#8b5cf6" />
              <circle cx="22" cy="22" r="5" fill="#10b981" />
            </svg>
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <button
              onClick={() => navigate('home')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${isHome ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
              title="Tracker"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            </button>
            <button
              onClick={() => navigate('summary-archive')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSummary ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
              title="Summary"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </button>
            <button
              onClick={() => navigate('team')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${isTeam ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
              title="Team"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
            </button>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => navigate('settings')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSettings ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
            <button
              onClick={() => navigate('profile')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${isProfile ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white' : 'hover:opacity-90'}`}
              title="My Profile"
              aria-label="My Profile"
            >
              <AvatarBadge profile={userProfile} size="md" />
            </button>
          </div>
        </nav>

        {/* ===== Main content column ===== */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {isHome ? (
            <main className="flex-1 overflow-auto">
              <HomeScreen />
            </main>
          ) : screen === 'prepare-summary' ? (
            <PrepareSummaryScreen />
          ) : screen === 'daily-summary' ? (
            <DailyWorkSummaryScreen />
          ) : screen === 'performance-review' ? (
            <PerformanceReviewScreen />
          ) : screen === 'summary-archive' ? (
            <SummaryArchiveScreen />
          ) : isTeam ? (
            <TeamGateScreen />
          ) : isSettings ? (
            <SettingsScreen />
          ) : isProfile ? (
            <ProfileScreen />
          ) : null}

          {/* ===== Mobile Bottom Tab Bar — Tracker / Summary / Team / Settings =====
              Profile lives in the home header avatar on mobile so we don't
              show the same icon twice. Team links to the paywall preview. */}
          {(isHome || isSettings || isProfile || isTeam || screen === 'summary-archive') && (
            <nav className="md:hidden bg-white border-t border-slate-100 px-2 pb-6 pt-2 flex items-center justify-around shrink-0">
              <button onClick={() => navigate('home')} className={`flex flex-col items-center gap-0.5 px-3 py-1 ${isHome ? 'text-blue-500' : 'text-slate-400'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                <span className={`text-[10px] ${isHome ? 'font-semibold' : 'font-medium'}`}>Tracker</span>
              </button>
              <button onClick={() => navigate('summary-archive')} className={`flex flex-col items-center gap-0.5 px-3 py-1 ${screen === 'summary-archive' ? 'text-blue-500' : 'text-slate-400'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className={`text-[10px] ${screen === 'summary-archive' ? 'font-semibold' : 'font-medium'}`}>Summary</span>
              </button>
              <button
                onClick={() => navigate('team')}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 ${isTeam ? 'text-blue-500' : 'text-slate-400'}`}
                title="Team"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                <span className={`text-[10px] ${isTeam ? 'font-semibold' : 'font-medium'}`}>Team</span>
              </button>
              <button onClick={() => navigate('settings')} className={`flex flex-col items-center gap-0.5 px-3 py-1 ${isSettings ? 'text-blue-500' : 'text-slate-400'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
                <span className={`text-[10px] ${isSettings ? 'font-semibold' : 'font-medium'}`}>Settings</span>
              </button>
            </nav>
          )}
        </div>
      </div>
    </NavProvider>
  );
};
