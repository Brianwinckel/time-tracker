// ============================================================
// Hybrid storage layer — Supabase (source of truth) + localStorage (cache)
// Write-through: writes go to both. Reads prefer localStorage for speed,
// with Supabase as the authoritative source on init.
// ============================================================

import * as local from './localStorage';
import * as remote from './supabase';
import type { Task, TimeEntry, Settings } from '../types';

// Debounce helper for Supabase writes
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
function debounce(key: string, fn: () => void, ms = 500): void {
  if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
  debounceTimers[key] = setTimeout(fn, ms);
}

// ---- Tasks ----

export async function loadTasks(userId: string): Promise<Task[]> {
  // Try Supabase first (authoritative)
  const tasks = await remote.loadTasks(userId);
  if (tasks.length > 0) {
    local.saveTasks(tasks); // update cache
    return tasks;
  }
  // Fallback to localStorage cache
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

export async function loadEntries(userId: string, date: string): Promise<TimeEntry[]> {
  const entries = await remote.loadEntries(userId, date);
  if (entries.length > 0) {
    local.saveEntries(date, entries);
    return entries;
  }
  return local.loadEntries(date);
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
  const settings = await remote.loadSettings(userId);
  if (settings) {
    local.saveSettings(settings);
    return settings;
  }
  return local.loadSettings();
}

export function saveSettings(userId: string, settings: Settings): void {
  local.saveSettings(settings);
  debounce('settings', () => remote.saveSettings(userId, settings));
}

// ---- Daily Notes ----

export async function loadDailyNote(userId: string, date: string): Promise<string> {
  const note = await remote.loadDailyNote(userId, date);
  if (note) {
    local.saveDailyNote(date, note);
    return note;
  }
  return local.loadDailyNote(date);
}

export function saveDailyNote(userId: string, date: string, note: string): void {
  local.saveDailyNote(date, note);
  debounce(`daily-note-${date}`, () => remote.saveDailyNote(userId, date, note));
}

// ---- Active entry ----

export async function loadActiveEntryId(userId: string, date: string): Promise<string | null> {
  const id = await remote.loadActiveEntryId(userId, date);
  if (id) {
    local.saveActiveEntryId(id);
    return id;
  }
  return local.loadActiveEntryId();
}

export function saveActiveEntryId(id: string | null): void {
  local.saveActiveEntryId(id);
  // Active entry ID is derived from time_entries, no separate remote save needed
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
