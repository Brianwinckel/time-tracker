// ============================================================
// TaskPanelsApp — the shared V6 application shell
// Used by both the real app (src/App.tsx) and the standalone
// preview entry (src/preview.tsx). Owns all the local state
// (catalog, panels, runs, timers, breaks, projects, profile,
// summary) via NavProvider. Persistence is localStorage.
// ============================================================

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { FullscreenPanelScreen } from './screens/FullscreenPanelScreen';
import { PickPanelScreen } from './screens/PickPanelScreen';
import { AvatarBadge } from './AvatarBadge';
import { TaskPanelsLogo } from './TaskPanelsLogo';
import { SyncIndicator } from './SyncIndicator';

// Lazy-loaded screens — each becomes its own code-split chunk so
// users don't pay the download cost unless they navigate there. Home,
// PickPanel, and FullscreenPanel stay eager because they're on the
// critical home flow and transitions between them should feel instant.
const PrepareSummaryScreen    = lazy(() => import('./screens/PrepareSummaryScreen').then(m => ({ default: m.PrepareSummaryScreen })));
const DailyWorkSummaryScreen  = lazy(() => import('./screens/DailyWorkSummaryScreen').then(m => ({ default: m.DailyWorkSummaryScreen })));
const PerformanceReviewScreen = lazy(() => import('./screens/PerformanceReviewScreen').then(m => ({ default: m.PerformanceReviewScreen })));
const SummaryArchiveScreen    = lazy(() => import('./screens/SummaryArchiveScreen').then(m => ({ default: m.SummaryArchiveScreen })));
const TeamGateScreen          = lazy(() => import('./screens/TeamGateScreen').then(m => ({ default: m.TeamGateScreen })));
const OnboardingScreen        = lazy(() => import('./screens/OnboardingScreen').then(m => ({ default: m.OnboardingScreen })));
const SettingsScreen          = lazy(() => import('./screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const ProfileScreen           = lazy(() => import('./screens/ProfileScreen').then(m => ({ default: m.ProfileScreen })));

// Lightweight placeholder shown while a lazy screen chunk downloads.
// Matches the AuthGate loader visually so the brief flash feels
// intentional instead of broken.
const ScreenFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full w-full bg-white gap-3">
    <TaskPanelsLogo size={48} animated />
  </div>
);
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
  colorOptionFor,
  makeMeetingPanel,
  makeCommutePanel,
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

// ---- Daily auto-reset utilities (module-level, no hooks) ----

const LAST_ACTIVE_DATE_KEY = 'taskpanels.lastActiveDate';

/** Today's date as "YYYY-MM-DD" in local time. */
const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Milliseconds until the next local midnight. */
const msUntilMidnight = (): number => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
};

/** Epoch ms of the most recent local midnight (i.e., start of today). */
const startOfTodayMs = (): number => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

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
  'settings-summary-defaults',
  'settings-email-template',
  'settings-auto-email',
  'settings-data-export',
  'settings-reset',
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

  // Clean up post-checkout / post-portal query params on mount so they
  // don't stick around through page reloads. The paywall has already
  // done its job (we wouldn't be rendering TaskPanelsApp otherwise).
  // First-time users auto-route to onboarding via initialScreen()'s
  // loadOnboarding() check, so we don't need to branch on `new=1`.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('checkout') || params.has('portal') || params.has('new')) {
      params.delete('checkout');
      params.delete('portal');
      params.delete('new');
      const q = params.toString();
      const cleaned = `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', cleaned);
    }
  }, []);

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
    const dayStart = startOfTodayMs();
    const acc: Record<BreakKind, number> = { break: 0, lunch: 0 };
    for (const r of runs) {
      if (r.endedAt <= dayStart) continue;
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

  // One-time migration: map old free-text profile.defaultAudience to
  // the typed preferences.defaultAudience enum. Runs on first mount
  // only; clears the old string after migrating so it doesn't re-fire.
  useEffect(() => {
    const old = userProfile.defaultAudience?.trim().toLowerCase();
    if (!old) return;
    // Only migrate if the preference is still at default.
    if (preferences.defaultAudience !== 'manager') return;
    const MIGRATE_MAP: Record<string, AppPreferences['defaultAudience']> = {
      manager: 'manager',
      internal: 'team',
      team: 'team',
      client: 'client',
      personal: 'personal',
    };
    const mapped = MIGRATE_MAP[old];
    if (mapped && mapped !== 'manager') {
      setPreferencesState(prev => ({ ...prev, defaultAudience: mapped }));
    }
    // Clear the legacy field so this doesn't re-fire.
    updateProfile({ defaultAudience: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    //
    // Back-start trimming: when the slider is moved for the currently active
    // panel, the implied start time (now - ms) is in the past. Any other
    // panel whose run ends after that implied start overlaps — trim those
    // runs back so time accounting stays consistent. This handles the "I
    // should have switched 30 min ago" case: Panel A's banked run shrinks
    // by the same amount Panel B was back-started.
    const safe = Math.max(0, Math.floor(ms));
    const now = Date.now();
    const isActivePanel = activeTimerRef.current?.panelId === panelId;
    setRuns(prev => {
      // Remove all existing runs for this panel.
      const others = prev.filter(r => r.panelId !== panelId);

      // When adjusting the active panel, trim overlapping runs from other panels.
      const impliedStart = now - safe;
      const trimmedOthers: Run[] = isActivePanel && safe > 0
        ? others.flatMap(r => {
            if (r.endedAt <= impliedStart) return [r]; // no overlap, keep as-is
            const trimmedEnd = impliedStart;
            if (trimmedEnd <= r.startedAt) return []; // fully consumed, drop
            return [{ ...r, endedAt: trimmedEnd }];
          })
        : others;

      if (safe > 0) {
        trimmedOthers.push(makeRun(panelId, impliedStart, now));
      }
      return trimmedOthers;
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
    setPanelCatalog(prev => prev.map(p => p.id === id ? { ...p, status: 'archived' as const } : p));
  }, []);

  const restorePanel = useCallback((id: string) => {
    setPanelCatalog(prev => prev.map(p => p.id === id ? { ...p, status: 'active' as const } : p));
  }, []);

  const updateCatalogPanel = useCallback(
    (id: string, patch: { name?: string; colorId?: string }) => {
      setPanelCatalog(prev =>
        prev.map(p => {
          if (p.id !== id) return p;
          const name = patch.name?.trim() || p.name;
          const colorId = patch.colorId ?? p.color;
          const opt = colorOptionFor(colorId);
          return {
            ...p,
            name,
            color: opt.id,
            bgClass: opt.bgClass,
            borderClass: opt.borderClass,
            barClass: opt.barClass,
            timerColorClass: opt.timerColorClass,
            activeColorClass: opt.activeColorClass,
          };
        }),
      );
    },
    [],
  );

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

  const createCommuteInstance = useCallback(
    (input: { name?: string; colorId?: string } = {}): Panel => {
      const instance = makeCommutePanel(input);
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

  // Silently archive yesterday's panel instances when the calendar day rolls
  // over. `cutoff` is the epoch ms of midnight — any running timer is ended
  // there so the run lands on yesterday in reports, not today.
  const performMidnightReset = useCallback((cutoff: number) => {
    const cur = activeTimerRef.current;
    if (cur) {
      appendRun(cur.panelId, cur.startedAt, cutoff);
      setActiveTimer(null);
    }
    flushBreakRun(activeBreakRef.current, cutoff);
    setActiveBreak(null);
    setPanels(prev => prev.map(p => (p.status === 'active' ? { ...p, status: 'done' } : p)));
    try { localStorage.setItem(LAST_ACTIVE_DATE_KEY, todayISO()); } catch { /* ignore */ }
  }, [appendRun, flushBreakRun]);

  // On mount: if the stored last-active date is from a previous day, fire the
  // reset immediately (handles overnight case and multi-day absence).
  useEffect(() => {
    const stored = (() => { try { return localStorage.getItem(LAST_ACTIVE_DATE_KEY); } catch { return null; } })();
    const today = todayISO();
    if (stored !== today) {
      // End any in-flight run at the midnight boundary that just passed.
      performMidnightReset(startOfTodayMs());
    }
    // Stamp today so tomorrow's load can detect the day change.
    try { localStorage.setItem(LAST_ACTIVE_DATE_KEY, today); } catch { /* ignore */ }
    // Intentional: run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While the app stays open, schedule a reset at the next midnight boundary
  // and reschedule on each firing so long sessions are always covered.
  useEffect(() => {
    let timeoutId: number;
    const scheduleNext = () => {
      timeoutId = window.setTimeout(() => {
        performMidnightReset(Date.now());
        scheduleNext();
      }, msUntilMidnight());
    };
    scheduleNext();
    return () => window.clearTimeout(timeoutId);
  }, [performMidnightReset]);

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
  const [pendingReportDate, setPendingReportDate] = useState<string | null>(null);

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
    restorePanel,
    updateCatalogPanel,
    panels,
    createPanelInstance,
    createPanelAndStart,
    createMeetingInstance,
    createCommuteInstance,
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
    pendingReportDate,
    setPendingReportDate,
  };

  // Onboarding — fullscreen, no sidebar/nav, no NavProvider needed
  if (screen === 'onboarding') {
    return (
      <Suspense fallback={<ScreenFallback />}>
        <OnboardingScreen
          onComplete={({ roleLabel, audience }) => {
            // Reload the catalog from localStorage (OnboardingScreen persisted it).
            setPanelCatalog(loadCatalog());
            // Seed the user's profile with the role they picked during
            // onboarding so ProfileScreen isn't mysteriously empty. Only
            // write if the user hasn't already filled it (re-onboarding
            // later shouldn't clobber a manually-tuned role).
            updateProfile({
              role: userProfile.role.trim() || roleLabel,
            });
            // Map the onboarding audience pick to the preferences enum.
            // Onboarding uses 'internal' while preferences uses 'team'.
            const AUDIENCE_MAP: Record<string, AppPreferences['defaultAudience']> = {
              manager: 'manager',
              internal: 'team',
              client: 'client',
              personal: 'personal',
            };
            const mapped = AUDIENCE_MAP[audience] ?? 'manager';
            setPreference('defaultAudience', mapped);
            navigate('home');
          }}
        />
      </Suspense>
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
    screen === 'performance-review';
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
      {/* Floats top-right, hidden in the happy path. Rendered inside
          NavProvider so a future variant can navigate on click. */}
      <SyncIndicator />
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
              onClick={() => navigate('prepare-summary')}
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
          ) : (
            // Suspense fallback covers the brief chunk download for
            // any lazy-loaded screen. Home and the fullscreen flows
            // (panel, pick-panel) handle their own rendering above
            // and never fall into this branch.
            <Suspense fallback={<ScreenFallback />}>
              {screen === 'prepare-summary'    ? <PrepareSummaryScreen />    :
               screen === 'daily-summary'      ? <DailyWorkSummaryScreen />  :
               screen === 'performance-review' ? <PerformanceReviewScreen /> :
               screen === 'summary-archive'    ? <SummaryArchiveScreen />    :
               isTeam                           ? <TeamGateScreen />          :
               isSettings                       ? <SettingsScreen />          :
               isProfile                        ? <ProfileScreen />           :
               null}
            </Suspense>
          )}

          {/* ===== Mobile Bottom Tab Bar — Tracker / Summary / Team / Settings =====
              Profile lives in the home header avatar on mobile so we don't
              show the same icon twice. Team links to the paywall preview. */}
          {(isHome || isSettings || isProfile || isTeam || isSummary || screen === 'summary-archive') && (
            <nav className="md:hidden bg-white border-t border-slate-100 px-2 pb-6 pt-2 flex items-center justify-around shrink-0">
              <button onClick={() => navigate('home')} className={`flex flex-col items-center gap-0.5 px-3 py-1 ${isHome ? 'text-blue-500' : 'text-slate-400'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                <span className={`text-[10px] ${isHome ? 'font-semibold' : 'font-medium'}`}>Tracker</span>
              </button>
              <button onClick={() => navigate('prepare-summary')} className={`flex flex-col items-center gap-0.5 px-3 py-1 ${isSummary ? 'text-blue-500' : 'text-slate-400'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className={`text-[10px] ${isSummary ? 'font-semibold' : 'font-medium'}`}>Summary</span>
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
