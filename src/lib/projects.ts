// ============================================================
// Projects — first-class workflow + reporting object
// ------------------------------------------------------------
// A Project is a real entity (not just a string field on a
// panel). Panels, runs, and summaries reference projects by id
// so they can be renamed, archived, and rolled up cleanly in
// reports.
//
// Persistence mirrors panelCatalog.ts:
//   * `loadProjects()` / `saveProjects()` round-trip via
//     `taskpanels.projects.v1`.
//   * `lastUsedAt` is bumped each time the user assigns a panel
//     to a project, so the Full-Screen picker can surface
//     "Recent" without scanning runs.
// ============================================================

import { colorOptionFor, type PanelColorOption } from './panelCatalog';
import { diffPushProjects } from './cloudRelational';

// ---- Entity ----

export interface Project {
  id: string;
  name: string;
  /** Short color name — keys into PANEL_COLOR_OPTIONS. */
  colorId: string;
  /** Optional client / context label, surfaced in lists and reports. */
  client?: string;
  /** Free-form description used in Settings > Projects. */
  description?: string;
  archived: boolean;
  createdAt: number;
  /** Bumped when a panel/run is assigned to this project. Drives Recent. */
  lastUsedAt: number;
  /** When set, the project is visible to every member of that
   *  department. null/undefined = private (only the owner sees it). */
  departmentId?: string | null;
  /** The auth.users.id of whoever created the project. Populated
   *  on hydrate from the cloud; used client-side so the diff push
   *  skips rows the current user doesn't own, and so the UI can
   *  render shared-but-not-owned projects as read-only.
   *  Undefined on freshly-created local projects (they're always
   *  owned by the current user until they hit the cloud). */
  ownerUserId?: string;
}

/** Convenience: a Project with its resolved color option. */
export interface ProjectWithColor extends Project {
  colorOption: PanelColorOption;
}

export function withColor(project: Project): ProjectWithColor {
  return { ...project, colorOption: colorOptionFor(project.colorId) };
}

// ---- Factory ----

function newProjectId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeProject(input: {
  id?: string;
  name: string;
  colorId?: string;
  client?: string;
  description?: string;
  departmentId?: string | null;
}): Project {
  const now = Date.now();
  return {
    id: input.id ?? newProjectId(),
    name: input.name.trim() || 'Untitled Project',
    colorId: input.colorId ?? 'blue',
    client: input.client?.trim() || undefined,
    description: input.description?.trim() || undefined,
    archived: false,
    createdAt: now,
    lastUsedAt: now,
    departmentId: input.departmentId ?? null,
  };
}

// ---- Defaults ----

/** No seeded projects — new users start with a blank list and add
 *  their own from Settings > Projects. */
export const DEFAULT_PROJECTS: Project[] = [];

// ---- Persistence ----

const PROJECTS_STORAGE_KEY = 'taskpanels.projects.v1';

export function loadProjects(): Project[] {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_PROJECTS;
  try {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return DEFAULT_PROJECTS;
    const parsed = JSON.parse(raw) as Project[];
    if (!Array.isArray(parsed)) return DEFAULT_PROJECTS;
    // Re-shape each entry through makeProject so missing fields
    // (added in later versions) get sensible defaults.
    return parsed.map(p => ({
      ...makeProject({
        id: p.id,
        name: p.name ?? 'Untitled Project',
        colorId: p.colorId ?? 'blue',
        client: p.client,
        description: p.description,
        departmentId: p.departmentId ?? null,
      }),
      archived: Boolean(p.archived),
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
      lastUsedAt: typeof p.lastUsedAt === 'number' ? p.lastUsedAt : (p.createdAt ?? Date.now()),
      ownerUserId: typeof p.ownerUserId === 'string' ? p.ownerUserId : undefined,
    }));
  } catch {
    return DEFAULT_PROJECTS;
  }
}

export function saveProjects(projects: Project[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch {
    /* quota or privacy mode — ignore */
  }
  diffPushProjects(projects);
}

// ---- Helpers ----

/** Active (non-archived) projects, sorted alphabetically. */
export function activeProjects(projects: Project[]): Project[] {
  return projects
    .filter(p => !p.archived)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Most-recently-used active projects, newest first. Used by the
 * Full-Screen Panel picker to show a "Recent" row.
 */
export function getRecentProjects(projects: Project[], limit = 5): Project[] {
  return projects
    .filter(p => !p.archived)
    .slice()
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, limit);
}

/** Look up a project by id. Returns undefined for unknown ids. */
export function findProject(projects: Project[], id: string | null | undefined): Project | undefined {
  if (!id) return undefined;
  return projects.find(p => p.id === id);
}

/** Filter active projects by a free-text query (name + client). */
export function searchProjects(projects: Project[], query: string): Project[] {
  const q = query.trim().toLowerCase();
  if (!q) return activeProjects(projects);
  return activeProjects(projects).filter(p => {
    if (p.name.toLowerCase().includes(q)) return true;
    if (p.client && p.client.toLowerCase().includes(q)) return true;
    return false;
  });
}
