// Lightweight navigation + app-state context for the preview app.
// Carries the two-tier panel model: a catalog of PanelTypes (templates)
// and the list of live Panel instances on Home, plus the append-only
// Run log that powers the daily-summary timeline.

import React, { createContext, useContext } from 'react';
import type { SummaryInput } from './summaryModel';
import type { MockPanel, Panel, Run } from './panelCatalog';
import { DEFAULT_PANELS } from './panelCatalog';
import type { Project } from './projects';
import { DEFAULT_PROJECTS } from './projects';
import type { UserProfile } from './profile';
import { DEFAULT_PROFILE } from './profile';

export type PreviewScreen =
  | 'onboarding'
  | 'home'
  | 'panel'
  | 'pick-panel'
  | 'prepare-summary'
  | 'daily-summary'
  | 'performance-review'
  | 'summary-archive'
  | 'team'
  | 'profile'
  | 'settings'
  | 'settings-projects'
  | 'settings-panels'
  | 'settings-advanced-labels';

export type NavigateOptions = {
  panelId?: string;
};

/** Currently running timer, or null if nothing is being tracked.
 *  `panelId` is a Panel *instance* id (not a catalog type id). */
export type ActiveTimer = { panelId: string; startedAt: number } | null;

/** A pause-style countdown (break or lunch). */
export type BreakKind = 'break' | 'lunch';
export type ActiveBreak = {
  kind: BreakKind;
  startedAt: number;
  durationMs: number;
  /** The panel instance the user was timing before the break. */
  resumePanelId: string | null;
} | null;

type NavContextValue = {
  screen: PreviewScreen;
  /** The Panel *instance* id the Fullscreen view should render. */
  selectedPanelId: string | null;
  navigate: (screen: PreviewScreen, opts?: NavigateOptions) => void;

  // ---- Catalog (stable PanelTypes the user can pick from) ----
  panelCatalog: MockPanel[];
  /** Create a new catalog entry (PanelType). */
  createPanel: (input: { name: string; colorId: string }) => MockPanel;
  /** Remove a catalog entry. Live Panel instances of that type are left
   *  alone — they keep their snapshotted visuals. */
  removePanel: (id: string) => void;

  // ---- Live Panel instances on Home ----
  panels: Panel[];
  /** Create a live Panel instance from a catalog type and immediately
   *  start its first run. Returns the new instance. */
  createPanelInstance: (typeId: string) => Panel | null;
  /** Patch an instance's editable fields (project, workType, focusNote, etc.). */
  updatePanel: (id: string, patch: Partial<Panel>) => void;
  /** Delete a live instance. Stops the timer if it was running. */
  deletePanelInstance: (id: string) => void;
  /** Stop the active run, mark every active instance as `done`, and
   *  navigate to Prepare Summary. */
  endMyDay: () => void;

  // ---- Runs (append-only tracked segments) ----
  runs: Run[];
  /** Derived: accumulated ms per Panel instance id (walks runs + active). */
  panelAccum: Record<string, number>;
  /** The currently running timer, or null. */
  activeTimer: ActiveTimer;
  /** Flush any running timer, then start a new run for this Panel instance. */
  startPanelTimer: (panelId: string) => void;
  /** Flush the running timer (if any) and leave nothing active. */
  stopPanelTimer: () => void;
  /** Manually override a Panel instance's total elapsed time. */
  setPanelElapsed: (panelId: string, ms: number) => void;

  // ---- Break / Lunch countdown ----
  activeBreak: ActiveBreak;
  breakDurationsMs: Record<BreakKind, number>;
  startBreak: (kind: BreakKind) => void;
  cancelBreak: () => void;
  breakAccum: Record<BreakKind, number>;

  // ---- Projects (first-class workflow + reporting object) ----
  projects: Project[];
  /** Create a new project and return it. Bumps lastUsedAt to now. */
  createProject: (input: { name: string; colorId?: string; client?: string; description?: string }) => Project;
  /** Patch an existing project's editable fields. */
  updateProject: (id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>) => void;
  /** Soft-archive a project. Existing panels keep their projectId. */
  archiveProject: (id: string) => void;
  /** Restore an archived project. */
  unarchiveProject: (id: string) => void;
  /** Hard-delete a project. Panels referencing it are left dangling. */
  deleteProject: (id: string) => void;
  /** Bump lastUsedAt without other edits. Called when a panel picks this project. */
  touchProject: (id: string) => void;

  // ---- User profile ("My account" — name, avatar, role, etc.) ----
  userProfile: UserProfile;
  /** Patch any subset of profile fields. Persists to localStorage. */
  updateProfile: (patch: Partial<UserProfile>) => void;

  // ---- Generated summary snapshot ----
  currentSummary: SummaryInput | null;
  setCurrentSummary: (input: SummaryInput | null) => void;

  // ---- Saved summaries archive ----
  /** Map of local ISO date ("YYYY-MM-DD") → the SummaryInput the
   *  user generated for that day. Re-generating overwrites. */
  savedSummaries: Record<string, SummaryInput>;
  /** Persist a SummaryInput into the archive. Daily reports land
   *  under their report-window start date; non-daily kinds are
   *  currently ignored (the archive is per-day for now). */
  saveSummary: (input: SummaryInput) => void;
  /** Drop a saved summary by ISO date key. */
  deleteSavedSummary: (iso: string) => void;
};

const NavContext = createContext<NavContextValue | null>(null);

export const NavProvider: React.FC<{
  value: NavContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
};

export const useNav = (): NavContextValue => {
  const ctx = useContext(NavContext);
  if (!ctx) {
    // Soft fallback so screens still render in isolation (e.g. Storybook).
    const noop = () => {
      /* no-op outside provider */
    };
    return {
      screen: 'home',
      selectedPanelId: null,
      navigate: noop,
      panelCatalog: DEFAULT_PANELS,
      createPanel: () => DEFAULT_PANELS[0],
      removePanel: noop,
      panels: [],
      createPanelInstance: () => null,
      updatePanel: noop,
      deletePanelInstance: noop,
      endMyDay: noop,
      runs: [],
      panelAccum: {},
      activeTimer: null,
      startPanelTimer: noop,
      stopPanelTimer: noop,
      setPanelElapsed: noop,
      activeBreak: null,
      breakDurationsMs: { break: 15 * 60 * 1000, lunch: 60 * 60 * 1000 },
      startBreak: noop,
      cancelBreak: noop,
      breakAccum: { break: 0, lunch: 0 },
      projects: DEFAULT_PROJECTS,
      createProject: ({ name, colorId }) => ({
        id: 'proj_noop',
        name,
        colorId: colorId ?? 'blue',
        archived: false,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      }),
      updateProject: noop,
      archiveProject: noop,
      unarchiveProject: noop,
      deleteProject: noop,
      touchProject: noop,
      userProfile: DEFAULT_PROFILE,
      updateProfile: noop,
      currentSummary: null,
      setCurrentSummary: noop,
      savedSummaries: {},
      saveSummary: noop,
      deleteSavedSummary: noop,
    };
  }
  return ctx;
};
