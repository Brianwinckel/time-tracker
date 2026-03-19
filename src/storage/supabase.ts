// ============================================================
// Storage adapter — Supabase implementation
// Same function signatures as localStorage.ts, scoped by userId
// ============================================================

import { supabase } from '../lib/supabase';
import type { Task, TimeEntry, Settings } from '../types';

// ---- Tasks ----

export async function loadTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('"order"');

  if (error) {
    console.error('Failed to load tasks:', error.message);
    return [];
  }

  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    color: row.color,
    isDefault: !row.is_custom,
    isPinned: row.is_pinned,
    createdAt: row.created_at,
    order: row.order,
  }));
}

export async function saveTasks(userId: string, tasks: Task[]): Promise<void> {
  // Upsert all tasks — this handles adds and updates
  const rows = tasks.map(t => ({
    id: t.id,
    user_id: userId,
    name: t.name,
    color: t.color,
    is_custom: !t.isDefault,
    is_pinned: t.isPinned,
    order: t.order,
    created_at: t.createdAt,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('tasks')
    .upsert(rows, { onConflict: 'id' });

  if (error) console.error('Failed to save tasks:', error.message);
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) console.error('Failed to delete task:', error.message);
}

// ---- Time Entries ----

export async function loadEntries(userId: string, date: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('start_time');

  if (error) {
    console.error('Failed to load entries:', error.message);
    return [];
  }

  return (data ?? []).map(row => ({
    id: row.id,
    taskId: row.task_id,
    taskName: row.task_name,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration_ms,
    note: row.note,
  }));
}

export async function saveEntries(userId: string, date: string, entries: TimeEntry[]): Promise<void> {
  const rows = entries.map(e => ({
    id: e.id,
    user_id: userId,
    task_id: e.taskId,
    task_name: e.taskName,
    date: e.date || date,
    start_time: e.startTime,
    end_time: e.endTime,
    duration_ms: e.duration,
    note: e.note,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('time_entries')
    .upsert(rows, { onConflict: 'id' });

  if (error) console.error('Failed to save entries:', error.message);
}

export async function deleteEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', entryId);

  if (error) console.error('Failed to delete entry:', error.message);
}

// ---- Settings ----

export async function loadSettings(userId: string): Promise<Settings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  return {
    bossName: data.boss_name,
    myName: data.my_name,
    emailSubjectFormat: data.email_subject_format,
    greeting: data.greeting,
    signoff: data.signoff,
    timeFormat: data.time_format as '12h' | '24h',
    darkMode: data.dark_mode,
    idleWarningMinutes: data.idle_warning_minutes,
  };
}

export async function saveSettings(userId: string, settings: Settings): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: userId,
      boss_name: settings.bossName,
      my_name: settings.myName,
      email_subject_format: settings.emailSubjectFormat,
      greeting: settings.greeting,
      signoff: settings.signoff,
      time_format: settings.timeFormat,
      dark_mode: settings.darkMode,
      idle_warning_minutes: settings.idleWarningMinutes,
    }, { onConflict: 'user_id' });

  if (error) console.error('Failed to save settings:', error.message);
}

// ---- Daily Notes ----

export async function loadDailyNote(userId: string, date: string): Promise<string> {
  const { data, error } = await supabase
    .from('daily_notes')
    .select('note')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (error || !data) return '';
  return data.note;
}

export async function saveDailyNote(userId: string, date: string, note: string): Promise<void> {
  const { error } = await supabase
    .from('daily_notes')
    .upsert({
      user_id: userId,
      date,
      note,
    }, { onConflict: 'user_id,date' });

  if (error) console.error('Failed to save daily note:', error.message);
}

// ---- Active entry (derived from DB) ----

export async function loadActiveEntryId(userId: string, date: string): Promise<string | null> {
  const { data } = await supabase
    .from('time_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .is('end_time', null)
    .limit(1)
    .single();

  return data?.id ?? null;
}
