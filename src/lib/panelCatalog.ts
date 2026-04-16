// ============================================================
// Panel Catalog
// ------------------------------------------------------------
// Two-tier model:
//   * `MockPanel` (a.k.a. PanelType) — an entry in the user's catalog.
//     Stable template: name, color, maybe a canonical category. This is
//     what PickPanelScreen lists and the user picks from.
//   * `Panel` (instance) — a live card on Home. Created by picking a type,
//     then filled in with real context (project, work type, focus note).
//     Two "Web Design" cards can coexist on Home for different clients.
//   * `Run` — an append-only tracked segment. `panelId` points at a Panel
//     instance, or a sentinel (`__break__` / `__lunch__` / `__idle__`) for
//     non-work time. The daily timeline is built by walking Runs.
//
// TODO(onboarding): seed PanelTypes per ICP/job-role so new users land
// with a curated catalog instead of the generic four-panel default.
// ============================================================

export interface MockPanel {
  id: string;
  name: string;
  /** Short color name used to look up classes in color maps. */
  color: string;
  bgClass: string;
  borderClass: string;
  barClass: string;
  timerColorClass: string;
  activeColorClass: string;
  tasks: number;
  completed: number;
  /** Legacy display string — kept for shape compatibility with the
   *  older mock data. Real time is derived from NavContext's
   *  panelAccum + activeTimer, so this is not the source of truth. */
  time: string;
  isActive: boolean;
  /** Soft-delete status. Archived panels are hidden from the picker and
   *  home screen but retained in the catalog so historical reports can
   *  resolve their names. Defaults to 'active'. */
  status: 'active' | 'archived';
}

/** The palette a user can pick from when creating a new panel.
 *  Each option carries ALL the derived Tailwind class strings so
 *  the UI never has to compute them at render time (and so Tailwind's
 *  JIT can statically see every class we might emit). */
export interface PanelColorOption {
  /** Short name used as `panel.color` — also the lookup key in downstream color maps. */
  id: string;
  label: string;
  /** SVG-friendly hex, used for donut/chart fills. */
  hex: string;
  bgClass: string;
  borderClass: string;
  barClass: string;
  timerColorClass: string;
  activeColorClass: string;
}

export const PANEL_COLOR_OPTIONS: PanelColorOption[] = [
  {
    id: 'blue', label: 'Blue', hex: '#3b82f6',
    bgClass: 'bg-blue-50', borderClass: 'border-blue-200', barClass: 'bg-blue-500',
    timerColorClass: 'text-blue-600', activeColorClass: 'text-blue-500',
  },
  {
    id: 'emerald', label: 'Green', hex: '#10b981',
    bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200', barClass: 'bg-emerald-500',
    timerColorClass: 'text-emerald-600', activeColorClass: 'text-emerald-500',
  },
  {
    id: 'orange', label: 'Orange', hex: '#f97316',
    bgClass: 'bg-orange-50', borderClass: 'border-orange-200', barClass: 'bg-orange-400',
    timerColorClass: 'text-orange-600', activeColorClass: 'text-orange-500',
  },
  {
    id: 'purple', label: 'Purple', hex: '#8b5cf6',
    bgClass: 'bg-purple-50', borderClass: 'border-purple-200', barClass: 'bg-purple-500',
    timerColorClass: 'text-purple-600', activeColorClass: 'text-purple-500',
  },
  {
    id: 'rose', label: 'Rose', hex: '#f43f5e',
    bgClass: 'bg-rose-50', borderClass: 'border-rose-200', barClass: 'bg-rose-500',
    timerColorClass: 'text-rose-600', activeColorClass: 'text-rose-500',
  },
  {
    id: 'amber', label: 'Amber', hex: '#f59e0b',
    bgClass: 'bg-amber-50', borderClass: 'border-amber-200', barClass: 'bg-amber-500',
    timerColorClass: 'text-amber-600', activeColorClass: 'text-amber-500',
  },
  {
    id: 'teal', label: 'Teal', hex: '#14b8a6',
    bgClass: 'bg-teal-50', borderClass: 'border-teal-200', barClass: 'bg-teal-500',
    timerColorClass: 'text-teal-600', activeColorClass: 'text-teal-500',
  },
  {
    id: 'slate', label: 'Slate', hex: '#64748b',
    bgClass: 'bg-slate-100', borderClass: 'border-slate-300', barClass: 'bg-slate-500',
    timerColorClass: 'text-slate-600', activeColorClass: 'text-slate-500',
  },
];

export const colorOptionFor = (id: string): PanelColorOption =>
  PANEL_COLOR_OPTIONS.find(c => c.id === id) ?? PANEL_COLOR_OPTIONS[0];

/** Build a fully-shaped MockPanel from a (name, color) pair. */
export function makePanel(input: { id?: string; name: string; colorId: string }): MockPanel {
  const opt = colorOptionFor(input.colorId);
  const id =
    input.id ??
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `panel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  return {
    id,
    name: input.name,
    color: opt.id,
    bgClass: opt.bgClass,
    borderClass: opt.borderClass,
    barClass: opt.barClass,
    timerColorClass: opt.timerColorClass,
    activeColorClass: opt.activeColorClass,
    tasks: 0,
    completed: 0,
    time: '0:00:00',
    isActive: false,
    status: 'active',
  };
}

/** No seeded panels — new users start with an empty catalog populated
 *  via role-specific onboarding. Kept as a named constant so downstream
 *  fallbacks that reference DEFAULT_PANELS still compile. */
export const DEFAULT_PANELS: MockPanel[] = [];

/** Back-compat alias. Older code imports MOCK_PANELS from HomeScreen. */
export const MOCK_PANELS = DEFAULT_PANELS;

// ---- localStorage persistence ----

const STORAGE_KEY = 'taskpanels.catalog.v1';

export function loadCatalog(): MockPanel[] {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_PANELS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PANELS;
    const parsed = JSON.parse(raw) as MockPanel[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PANELS;
    // Guard against partial objects by re-building each entry from its color.
    return parsed.map(p => ({
      ...makePanel({ id: p.id, name: p.name ?? 'Untitled', colorId: p.color ?? 'blue' }),
      tasks: p.tasks ?? 0,
      completed: p.completed ?? 0,
      status: (p.status === 'archived' ? 'archived' : 'active') as 'active' | 'archived',
    }));
  } catch {
    return DEFAULT_PANELS;
  }
}

export function saveCatalog(panels: MockPanel[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
  } catch {
    /* quota or privacy mode — ignore */
  }
}

// ============================================================
// Panel instances (live cards on Home)
// ============================================================

export type PanelStatus = 'active' | 'done';

/** Session type classification at the Panel-instance level.
 *
 *  Why here and not on MockPanel (the catalog template)? Meetings
 *  are one-shot by nature — "Client Call, 3pm Tuesday" isn't a
 *  reusable template the user picks repeatedly. Work sessions are
 *  template-driven ("Website Refresh" is a catalog entry that
 *  spawns new instances). So the kind lives on the instance.
 *
 *  Break/Lunch are intentionally NOT in this enum. Those stay as
 *  sentinel panelIds on runs (BREAK_PANEL_ID / LUNCH_PANEL_ID)
 *  because they're utility countdowns, not tracked work the user
 *  labels with project + topic. Keeping them separate preserves the
 *  existing timer/countdown flow and the sentinel-based timeline
 *  rendering. */
export type PanelKind = 'work' | 'meeting';

/** Meeting-specific enums. All optional on Panel — work instances
 *  ignore them, meeting instances populate them during the session. */
export type MeetingType = 'planned' | 'impromptu';
export type MeetingAudience = 'internal' | 'client' | 'leadership' | 'vendor';

/** Human-readable labels for the meeting enums. Exported so the home
 *  screen subtitle, fullscreen picker, and summary renderer all render
 *  the same strings — if label text ever changes, change it here and
 *  every surface follows. */
export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  planned: 'Planned',
  impromptu: 'Impromptu',
};

export const MEETING_AUDIENCE_LABELS: Record<MeetingAudience, string> = {
  internal: 'Internal',
  client: 'Client',
  leadership: 'Leadership',
  vendor: 'Vendor / Partner',
};

/**
 * A Panel instance is one live card on Home. It's created from a catalog
 * entry (PanelType) and then carries its own project / work type / focus
 * note so the same type can power multiple simultaneous instances.
 *
 * Visual fields are snapshotted from the type at creation time, so an
 * instance keeps working even if the source type is later deleted or
 * recolored. The color picker in Fullscreen edits the instance, never
 * the type.
 */
export interface Panel {
  id: string;
  /** For work panels, the catalog template id this instance was spawned
   *  from. Meeting panels don't have a template — the field carries the
   *  MEETING_TYPE_ID sentinel so the downstream code can still group
   *  "all meetings" without special-casing undefined. */
  typeId: string;
  createdAt: number;
  status: PanelStatus;
  /** Session type — Work is the default (and what every legacy panel
   *  migrates to). Meetings get meeting-specific fields below and a
   *  different Fullscreen variant. */
  kind: PanelKind;
  // Snapshot from the type — editable per-instance afterward.
  name: string;
  color: string;
  bgClass: string;
  borderClass: string;
  barClass: string;
  timerColorClass: string;
  activeColorClass: string;
  // Per-instance context (previously lived in panelDrafts).
  /** Reference to a Project entity (lib/projects.ts). The canonical source of truth. */
  projectId?: string;
  /** Snapshot of the project's display name at assignment time. Kept so
   *  legacy summary/reporting code that reads `project` keeps working,
   *  and so deleted projects still render a name in past reports. */
  project?: string;
  workType?: string;
  focusNote?: string;
  notes?: string;
  tags?: string[];
  sessionState?: string;
  iconIndex?: number;
  // ---- Meeting-specific context (only set when kind === 'meeting') ----
  /** Planned (scheduled in advance) vs Impromptu (ad-hoc / walked-up). */
  meetingType?: MeetingType;
  /** Who the meeting is with. Single-select; null/undefined if unset. */
  audience?: MeetingAudience;
  /** Short purpose string — "What is this meeting about?" Reuses the same
   *  position as `focusNote` visually but is a distinct field so the
   *  report renderer can tell them apart and label accordingly. */
  topic?: string;
}

/** Sentinel typeId for meeting instances. Meetings have no catalog
 *  template (see PanelKind doc), but `typeId: string` is non-nullable,
 *  so we route them through this constant. Downstream code that groups
 *  instances by typeId should filter MEETING_TYPE_ID if it's showing
 *  the template list. */
export const MEETING_TYPE_ID = '__meeting__';

/** Build a fresh Panel instance from a catalog entry. */
export function makePanelFromType(type: MockPanel): Panel {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `panel_inst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    typeId: type.id,
    createdAt: Date.now(),
    status: 'active',
    kind: 'work',
    name: type.name,
    color: type.color,
    bgClass: type.bgClass,
    borderClass: type.borderClass,
    barClass: type.barClass,
    timerColorClass: type.timerColorClass,
    activeColorClass: type.activeColorClass,
  };
}

/** Build a fresh meeting Panel instance. Meetings have no catalog
 *  template — the caller supplies a name (defaulted by PickPanel) and
 *  optionally a color. A distinct factory keeps the type-narrowing
 *  clean for downstream code: `kind` is always 'meeting', never inferred.
 *
 *  Visual defaults to `slate` (a neutral, non-project accent) so meeting
 *  cards read as a different "category" of session at a glance, without
 *  looking broken if the user skips picking a color. */
export function makeMeetingPanel(input: {
  name?: string;
  colorId?: string;
} = {}): Panel {
  const opt = colorOptionFor(input.colorId ?? 'slate');
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `panel_meet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    typeId: MEETING_TYPE_ID,
    createdAt: Date.now(),
    status: 'active',
    kind: 'meeting',
    name: input.name?.trim() || 'Meeting',
    color: opt.id,
    bgClass: opt.bgClass,
    borderClass: opt.borderClass,
    barClass: opt.barClass,
    timerColorClass: opt.timerColorClass,
    activeColorClass: opt.activeColorClass,
  };
}

const PANELS_STORAGE_KEY = 'taskpanels.panels.v1';

export function loadPanels(): Panel[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(PANELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Panel[];
    if (!Array.isArray(parsed)) return [];
    // Re-hydrate visual fields by looking up the color option. Guards
    // against future theme tweaks that change class strings. Also
    // migrates any panel persisted before `kind` existed — it defaults
    // to 'work' so legacy instances keep flowing through the work-type
    // rendering path.
    return parsed.map(p => {
      const opt = colorOptionFor(p.color ?? 'blue');
      const kind: PanelKind = p.kind ?? 'work';
      // Scrub stale work-panel fields off meeting instances. An earlier
      // version of FullscreenPanelScreen unconditionally wrote the
      // `selectedWorkType` useState default ('Coding') back onto every
      // panel on mount, which corrupted meeting instances with a
      // misleading subtitle ("Show n Tell → Coding"). The write path is
      // now gated, but existing saved data still needs to be cleaned —
      // this migration runs once on next load and is otherwise a no-op.
      const workType = kind === 'meeting' ? undefined : p.workType;
      const focusNote = kind === 'meeting' ? undefined : p.focusNote;
      return {
        ...p,
        status: p.status ?? 'active',
        kind,
        workType,
        focusNote,
        createdAt: p.createdAt ?? Date.now(),
        bgClass: opt.bgClass,
        borderClass: opt.borderClass,
        barClass: opt.barClass,
        timerColorClass: opt.timerColorClass,
        activeColorClass: opt.activeColorClass,
      };
    });
  } catch {
    return [];
  }
}

export function savePanels(panels: Panel[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(panels));
  } catch {
    /* ignore */
  }
}

// ============================================================
// Runs (append-only tracked segments)
// ============================================================

/** Sentinel panelIds for non-work runs. Kept as string literals so the
 *  timeline renderer can switch on them. */
export const BREAK_PANEL_ID = '__break__';
export const LUNCH_PANEL_ID = '__lunch__';
export const IDLE_PANEL_ID = '__idle__';

export type RunKind = 'panel' | 'break' | 'lunch' | 'idle';

export interface Run {
  id: string;
  /** Either a Panel instance id, or one of BREAK/LUNCH/IDLE_PANEL_ID. */
  panelId: string;
  startedAt: number;
  endedAt: number;
}

export function runKind(run: Run): RunKind {
  if (run.panelId === BREAK_PANEL_ID) return 'break';
  if (run.panelId === LUNCH_PANEL_ID) return 'lunch';
  if (run.panelId === IDLE_PANEL_ID) return 'idle';
  return 'panel';
}

function newRunId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeRun(panelId: string, startedAt: number, endedAt: number): Run {
  return { id: newRunId(), panelId, startedAt, endedAt };
}

const RUNS_STORAGE_KEY = 'taskpanels.runs.v1';

export function loadRuns(): Run[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(RUNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Run[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      r =>
        r &&
        typeof r.id === 'string' &&
        typeof r.panelId === 'string' &&
        typeof r.startedAt === 'number' &&
        typeof r.endedAt === 'number',
    );
  } catch {
    return [];
  }
}

export function saveRuns(runs: Run[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(runs));
  } catch {
    /* ignore */
  }
}
