// ============================================================
// Storage adapter — localStorage implementation
// Swap this file to migrate to IndexedDB, SQLite, or a REST API
// ============================================================

import type { Task, TimeEntry, Settings, TagOption } from '../types';

const KEYS = {
  tasks: 'tt_tasks',
  entries: 'tt_entries',      // keyed by date internally
  settings: 'tt_settings',
  activeEntryId: 'tt_active_entry_id',
  lastTaskId: 'tt_last_task_id',
  currentDate: 'tt_current_date',
  dailyNote: 'tt_daily_note',
  tagOptions: 'tt_tag_options',
} as const;

// Generic helpers
function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function set(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---- Tasks ----

export function loadTasks(): Task[] {
  return get<Task[]>(KEYS.tasks, []);
}

export function saveTasks(tasks: Task[]): void {
  set(KEYS.tasks, tasks);
}

// ---- Time Entries ----
// Entries are stored per-date for efficient lookups

function entriesKey(date: string): string {
  return `${KEYS.entries}_${date}`;
}

export function loadEntries(date: string): TimeEntry[] {
  return get<TimeEntry[]>(entriesKey(date), []);
}

export function saveEntries(date: string, entries: TimeEntry[]): void {
  set(entriesKey(date), entries);
}

// Track which dates have entries (for history browsing)
export function getTrackedDates(): string[] {
  return get<string[]>('tt_tracked_dates', []);
}

export function addTrackedDate(date: string): void {
  const dates = getTrackedDates();
  if (!dates.includes(date)) {
    dates.push(date);
    dates.sort().reverse(); // newest first
    set('tt_tracked_dates', dates);
  }
}

// ---- Settings ----

export function loadSettings(): Settings | null {
  return get<Settings | null>(KEYS.settings, null);
}

export function saveSettings(settings: Settings): void {
  set(KEYS.settings, settings);
}

// ---- Active state ----

export function loadActiveEntryId(): string | null {
  return get<string | null>(KEYS.activeEntryId, null);
}

export function saveActiveEntryId(id: string | null): void {
  set(KEYS.activeEntryId, id);
}

export function loadLastTaskId(): string | null {
  return get<string | null>(KEYS.lastTaskId, null);
}

export function saveLastTaskId(id: string | null): void {
  set(KEYS.lastTaskId, id);
}

// ---- Daily note ----

export function loadDailyNote(date: string): string {
  return get<string>(`tt_daily_note_${date}`, '');
}

export function saveDailyNote(date: string, note: string): void {
  set(`tt_daily_note_${date}`, note);
}

// ---- Tag Options ----

export function loadTagOptions(): TagOption[] {
  return get<TagOption[]>(KEYS.tagOptions, []);
}

export function saveTagOptions(options: TagOption[]): void {
  set(KEYS.tagOptions, options);
}
