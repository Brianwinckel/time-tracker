// ============================================================
// Hybrid storage layer — Supabase (source of truth) + localStorage (cache)
// Write-through: writes go to both. Reads merge remote + local to prevent
// data loss from unflushed debounced writes.
// ============================================================

import * as local from './localStorage';
import * as remote from './supabase';
import type { Task, TimeEntry, Settings, TagOption } from '../types';

// Debounce helper for Supabase writes
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const pendingFns: Record<string, () => void> = {};

function debounce(key: string, fn: () => void, ms = 500): void {
  if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
  pendingFns[key] = fn;
  debounceTimers[key] = setTimeout(() => {
    delete pendingFns[key];
    fn();
  }, ms);
}

/** Flush all pending debounced writes immediately (call before sign-out / page unload) */
export async function flushPendingWrites(): Promise<void> {
  const fns = Object.entries(pendingFns);
  for (const [key] of fns) {
    if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
    delete debounceTimers[key];
  }
  const promises = fns.map(([key, fn]) => {
    delete pendingFns[key];
    try {
      return Promise.resolve(fn());
    } catch {
      return Promise.resolve();
    }
  });
  await Promise.allSettled(promises);
}

/** Check if there are pending writes that haven't been flushed yet */
export function hasPendingWrites(): boolean {
  return Object.keys(pendingFns).length > 0;
}

// ---- Tasks ----

export async function loadTasks(userId: string): Promise<Task[]> {
  try {
    const remoteTasks = await remote.loadTasks(userId);
    if (remoteTasks.length > 0) {
      local.saveTasks(remoteTasks);
      return remoteTasks;
    }
  } catch (err) {
    console.warn('Failed to load tasks from Supabase, using local cache:', err);
  }
  return local.loadTasks();
}

export function saveTasks(userId: string, tasks: Task[]): void {
  local.saveTasks(tasks); // instant cache write
  debounce('tasks', () => remote.saveTasks(userId, tasks));
}

export function deleteTask(_userId: string, taskId: string): void {
  debounce(`delete-task-${taskId}`, () => remote.deleteTask(taskId));
}

// ---- Entries ----

/**
 * Load entries by merging remote + local data.
 * This prevents data loss when debounced writes haven't flushed yet:
 * - Entries in local but not remote = unflushed writes → keep them
 * - Entries in remote but not local = synced from another device → keep them
 * - Entries in both = use remote version (authoritative)
 */
export async function loadEntries(userId: string, date: string): Promise<TimeEntry[]> {
  // Flush any pending entry writes for this date first
  const pendingKey = `entries-${date}`;
  if (pendingFns[pendingKey]) {
    const fn = pendingFns[pendingKey];
    if (debounceTimers[pendingKey]) clearTimeout(debounceTimers[pendingKey]);
    delete debounceTimers[pendingKey];
    delete pendingFns[pendingKey];
    try {
      await Promise.resolve(fn()); // await the actual write
    } catch (err) {
      console.warn('Failed to flush pending entry writes:', err);
    }
  }

  const localEntries = local.loadEntries(date);

  let remoteEntries: TimeEntry[] = [];
  try {
    remoteEntries = await remote.loadEntries(userId, date);
  } catch (err) {
    console.warn('Failed to load entries from Supabase, using local cache:', err);
    return localEntries;
  }

  // If remote has data, merge with local to catch any unflushed writes
  if (remoteEntries.length > 0) {
    const merged = mergeEntries(remoteEntries, localEntries);
    local.saveEntries(date, merged);
    return merged;
  }

  // Remote is empty — local might have unflushed data, or it's genuinely empty
  if (localEntries.length > 0) {
    // Push local entries to remote (they were never synced)
    debounce(`entries-${date}`, () => remote.saveEntries(userId, date, localEntries));
  }

  return localEntries;
}

/**
 * Merge two entry arrays by ID.
 * Remote entries take precedence (authoritative), but local-only entries are preserved.
 */
function mergeEntries(remoteEntries: TimeEntry[], localEntries: TimeEntry[]): TimeEntry[] {
  const remoteMap = new Map(remoteEntries.map(e => [e.id, e]));
  const merged = new Map<string, TimeEntry>();

  // Start with all remote entries
  for (const entry of remoteEntries) {
    merged.set(entry.id, entry);
  }

  // Add any local entries that aren't in remote (unflushed writes)
  for (const entry of localEntries) {
    if (!remoteMap.has(entry.id)) {
      merged.set(entry.id, entry);
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

export function saveEntries(userId: string, date: string, entries: TimeEntry[]): void {
  local.saveEntries(date, entries);
  debounce(`entries-${date}`, () => remote.saveEntries(userId, date, entries));
}

export function deleteEntry(entryId: string): void {
  debounce(`delete-entry-${entryId}`, () => remote.deleteEntry(entryId));
}

// ---- Settings ----

export async function loadSettings(userId: string): Promise<Settings | null> {
  try {
    const settings = await remote.loadSettings(userId);
    if (settings) {
      local.saveSettings(settings);
      return settings;
    }
  } catch (err) {
    console.warn('Failed to load settings from Supabase, using local cache:', err);
  }
  return local.loadSettings();
}

export function saveSettings(userId: string, settings: Settings): void {
  local.saveSettings(settings);
  debounce('settings', () => remote.saveSettings(userId, settings));
}

// ---- Daily Notes ----

export async function loadDailyNote(userId: string, date: string): Promise<string> {
  try {
    const note = await remote.loadDailyNote(userId, date);
    if (note) {
      local.saveDailyNote(date, note);
      return note;
    }
  } catch (err) {
    console.warn('Failed to load daily note from Supabase, using local cache:', err);
  }
  return local.loadDailyNote(date);
}

export function saveDailyNote(userId: string, date: string, note: string): void {
  local.saveDailyNote(date, note);
  debounce(`daily-note-${date}`, () => remote.saveDailyNote(userId, date, note));
}

// ---- Active entry ----

export async function loadActiveEntryId(userId: string, date: string): Promise<string | null> {
  try {
    const id = await remote.loadActiveEntryId(userId, date);
    if (id) {
      local.saveActiveEntryId(id);
      return id;
    }
  } catch (err) {
    console.warn('Failed to load active entry from Supabase, using local cache:', err);
  }
  return local.loadActiveEntryId();
}

export function saveActiveEntryId(id: string | null): void {
  local.saveActiveEntryId(id);
}

// ---- Last task ID (local-only convenience) ----

export function loadLastTaskId(): string | null {
  return local.loadLastTaskId();
}

export function saveLastTaskId(id: string | null): void {
  local.saveLastTaskId(id);
}

// ---- Tracked dates ----

export function addTrackedDate(date: string): void {
  local.addTrackedDate(date);
}

export function getTrackedDates(): string[] {
  return local.getTrackedDates();
}

// ---- Tag Options ----

export async function loadTagOptions(userId: string): Promise<TagOption[]> {
  try {
    const options = await remote.loadTagOptions(userId);
    if (options.length > 0) {
      local.saveTagOptions(options);
      return options;
    }
  } catch (err) {
    console.warn('Failed to load tag options from Supabase, using local cache:', err);
  }
  return local.loadTagOptions();
}

export function saveTagOption(option: TagOption): void {
  debounce(`tag-option-${option.id}`, () => remote.saveTagOption(option));
}

export function deleteTagOption(optionId: string): void {
  debounce(`delete-tag-${optionId}`, () => remote.deleteTagOption(optionId));
}
