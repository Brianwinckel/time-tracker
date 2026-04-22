// ============================================================
// cloudRelational — Supabase sync for the many-row tables
// (panels, runs, projects).
//
// Storage pattern mirrors cloudState.ts but at row granularity:
//   - localStorage stays authoritative for rendering (sync, fast)
//   - Each save computes a diff vs. the last pushed snapshot
//   - Upserts and deletes are debounced so rapid edits coalesce
//   - Runs are append-only: we insert new ones, never update/delete
//
// Hydration on sign-in:
//   - If cloud has rows → replace localStorage with cloud data
//   - If cloud is empty AND local has data → upload local to cloud
//     (one-time migration for users who used the app before this
//     Stage 3 shipped)
// ============================================================

import { supabase } from './supabase';
import { getCloudStateUser } from './cloudState';
import type { Panel, Run } from './panelCatalog';
import type { Project } from './projects';

// ---- Row-shape ↔ DB-shape mapping ---------------------------

interface DbPanelRow {
  id: string;
  user_id: string;
  status: string;
  data: Omit<Panel, 'status'>;
  created_at: string;
  updated_at?: string;
}

interface DbRunRow {
  id: string;
  user_id: string;
  panel_id: string;
  started_at: string;
  ended_at: string;
}

interface DbProjectRow {
  id: string;
  user_id: string;
  archived: boolean;
  data: Omit<Project, 'id' | 'archived' | 'createdAt'>;
  created_at: string;
  updated_at?: string;
}

function panelToDb(panel: Panel, userId: string): Omit<DbPanelRow, 'updated_at'> {
  const { status, ...rest } = panel;
  return {
    id: panel.id,
    user_id: userId,
    status,
    data: rest,
    created_at: new Date(panel.createdAt).toISOString(),
  };
}
function panelFromDb(row: DbPanelRow): Panel {
  // data column holds everything except the promoted status column.
  const data = row.data as Omit<Panel, 'status'>;
  return { ...data, id: row.id, status: row.status as Panel['status'] };
}

function runToDb(run: Run, userId: string): DbRunRow {
  return {
    id: run.id,
    user_id: userId,
    panel_id: run.panelId,
    started_at: new Date(run.startedAt).toISOString(),
    ended_at: new Date(run.endedAt).toISOString(),
  };
}
function runFromDb(row: DbRunRow): Run {
  return {
    id: row.id,
    panelId: row.panel_id,
    startedAt: new Date(row.started_at).getTime(),
    endedAt: new Date(row.ended_at).getTime(),
  };
}

function projectToDb(p: Project, userId: string): Omit<DbProjectRow, 'updated_at'> {
  const { id, archived, createdAt, ...rest } = p;
  return {
    id,
    user_id: userId,
    archived,
    data: rest,
    created_at: new Date(createdAt).toISOString(),
  };
}
function projectFromDb(row: DbProjectRow): Project {
  const data = row.data as Omit<Project, 'id' | 'archived' | 'createdAt'>;
  return {
    ...data,
    id: row.id,
    archived: row.archived,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// ---- Debounced batch writer ---------------------------------

// Per-table pending buckets. We collect upserts and deletes until a
// flush timer fires, then flush in a single round trip each.

interface Pending {
  upserts: Map<string, unknown>;
  deletes: Set<string>;
}
const pendings: Record<string, Pending> = {};
const flushTimers: Record<string, number> = {};
const FLUSH_MS = 500;

function getPending(table: string): Pending {
  if (!pendings[table]) {
    pendings[table] = { upserts: new Map(), deletes: new Set() };
  }
  return pendings[table];
}

function scheduleFlush(table: string): void {
  if (flushTimers[table]) return;
  flushTimers[table] = window.setTimeout(() => {
    delete flushTimers[table];
    flush(table).catch(err => console.error(`[cloudRelational] flush ${table}:`, err));
  }, FLUSH_MS);
}

async function flush(table: string): Promise<void> {
  const p = pendings[table];
  if (!p) return;
  const upserts = Array.from(p.upserts.values());
  const deletes = Array.from(p.deletes);
  pendings[table] = { upserts: new Map(), deletes: new Set() };

  if (upserts.length > 0) {
    const { error } = await supabase.from(table).upsert(upserts, { onConflict: 'id' });
    if (error) console.error(`[cloudRelational] ${table} upsert:`, error.message);
  }
  if (deletes.length > 0) {
    const { error } = await supabase.from(table).delete().in('id', deletes);
    if (error) console.error(`[cloudRelational] ${table} delete:`, error.message);
  }
}

// ---- Public API: Panels -------------------------------------

let lastPanels: Panel[] = [];

export function bindPanelsBaseline(panels: Panel[]): void {
  lastPanels = panels.map(p => ({ ...p })); // defensive copy
}

export function diffPushPanels(next: Panel[]): void {
  const userId = getCloudStateUser();
  if (!userId) return;
  const prevMap = new Map(lastPanels.map(p => [p.id, p]));
  const nextMap = new Map(next.map(p => [p.id, p]));
  const pending = getPending('user_panels');

  for (const [id, panel] of nextMap) {
    const prev = prevMap.get(id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(panel)) {
      pending.upserts.set(id, panelToDb(panel, userId));
    }
  }
  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) pending.deletes.add(id);
  }
  if (pending.upserts.size > 0 || pending.deletes.size > 0) {
    scheduleFlush('user_panels');
  }
  lastPanels = next.map(p => ({ ...p }));
}

// ---- Public API: Runs (append-only) -------------------------

let lastRunIds: Set<string> = new Set();

export function bindRunsBaseline(runs: Run[]): void {
  lastRunIds = new Set(runs.map(r => r.id));
}

export function diffPushRuns(next: Run[]): void {
  const userId = getCloudStateUser();
  if (!userId) return;
  const pending = getPending('user_runs');
  for (const run of next) {
    if (!lastRunIds.has(run.id)) {
      pending.upserts.set(run.id, runToDb(run, userId));
      lastRunIds.add(run.id);
    }
  }
  // No deletes for runs — they're append-only.
  if (pending.upserts.size > 0) scheduleFlush('user_runs');
}

// ---- Public API: Projects -----------------------------------

let lastProjects: Project[] = [];

export function bindProjectsBaseline(projects: Project[]): void {
  lastProjects = projects.map(p => ({ ...p }));
}

export function diffPushProjects(next: Project[]): void {
  const userId = getCloudStateUser();
  if (!userId) return;
  const prevMap = new Map(lastProjects.map(p => [p.id, p]));
  const nextMap = new Map(next.map(p => [p.id, p]));
  const pending = getPending('user_projects');

  for (const [id, project] of nextMap) {
    const prev = prevMap.get(id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(project)) {
      pending.upserts.set(id, projectToDb(project, userId));
    }
  }
  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) pending.deletes.add(id);
  }
  if (pending.upserts.size > 0 || pending.deletes.size > 0) {
    scheduleFlush('user_projects');
  }
  lastProjects = next.map(p => ({ ...p }));
}

// ---- Hydration ----------------------------------------------

export interface RelationalSnapshot {
  panels: Panel[];
  runs: Run[];
  projects: Project[];
}

/**
 * Full relational hydration.
 *
 * For each table: if cloud has rows → take cloud as truth and
 * overwrite local. If cloud is empty AND local has rows → upload
 * local to cloud (one-time migration for pre-Stage-3 users). If
 * both empty → nothing to do.
 *
 * Returns the merged snapshot the caller should write to
 * localStorage, plus sets the diff baselines so subsequent saves
 * push only what actually changed.
 */
export async function hydrateRelationalFromCloud(
  userId: string,
  localPanels: Panel[],
  localRuns: Run[],
  localProjects: Project[],
): Promise<RelationalSnapshot> {
  const [panelsRes, runsRes, projectsRes] = await Promise.all([
    supabase.from('user_panels').select('*').eq('user_id', userId),
    supabase.from('user_runs').select('*').eq('user_id', userId),
    supabase.from('user_projects').select('*').eq('user_id', userId),
  ]);

  // --- Panels ---
  let panels: Panel[];
  if (panelsRes.error) {
    console.error('[cloudRelational] panels fetch:', panelsRes.error.message);
    panels = localPanels;
  } else if ((panelsRes.data ?? []).length > 0) {
    panels = (panelsRes.data as DbPanelRow[]).map(panelFromDb);
  } else if (localPanels.length > 0) {
    // Upload local as initial migration.
    const rows = localPanels.map(p => panelToDb(p, userId));
    const { error } = await supabase.from('user_panels').upsert(rows, { onConflict: 'id' });
    if (error) console.error('[cloudRelational] initial panels upload:', error.message);
    panels = localPanels;
  } else {
    panels = [];
  }

  // --- Runs ---
  let runs: Run[];
  if (runsRes.error) {
    console.error('[cloudRelational] runs fetch:', runsRes.error.message);
    runs = localRuns;
  } else if ((runsRes.data ?? []).length > 0) {
    runs = (runsRes.data as DbRunRow[]).map(runFromDb);
  } else if (localRuns.length > 0) {
    const rows = localRuns.map(r => runToDb(r, userId));
    const { error } = await supabase.from('user_runs').upsert(rows, { onConflict: 'id' });
    if (error) console.error('[cloudRelational] initial runs upload:', error.message);
    runs = localRuns;
  } else {
    runs = [];
  }

  // --- Projects ---
  let projects: Project[];
  if (projectsRes.error) {
    console.error('[cloudRelational] projects fetch:', projectsRes.error.message);
    projects = localProjects;
  } else if ((projectsRes.data ?? []).length > 0) {
    projects = (projectsRes.data as DbProjectRow[]).map(projectFromDb);
  } else if (localProjects.length > 0) {
    const rows = localProjects.map(p => projectToDb(p, userId));
    const { error } = await supabase.from('user_projects').upsert(rows, { onConflict: 'id' });
    if (error) console.error('[cloudRelational] initial projects upload:', error.message);
    projects = localProjects;
  } else {
    projects = [];
  }

  // Set diff baselines so the next save pushes only real changes.
  bindPanelsBaseline(panels);
  bindRunsBaseline(runs);
  bindProjectsBaseline(projects);

  return { panels, runs, projects };
}
