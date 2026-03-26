// ============================================================
// Storage adapter — Supabase implementation
// Same function signatures as localStorage.ts, scoped by userId
// ============================================================

import { supabase } from '../lib/supabase';
import type { Task, TimeEntry, Settings, TagOption } from '../types';

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
    timerMinutes: row.timer_minutes ?? 0,
  }));
}

export async function saveTasks(userId: string, tasks: Task[]): Promise<void> {
  const rows = tasks.map(t => ({
    id: t.id,
    user_id: userId,
    name: t.name,
    color: t.color,
    is_custom: !t.isDefault,
    is_pinned: t.isPinned,
    order: t.order,
    created_at: t.createdAt,
    timer_minutes: t.timerMinutes ?? 0,
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

  return (data ?? []).map(mapRowToEntry);
}

function mapRowToEntry(row: Record<string, unknown>): TimeEntry {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    taskName: row.task_name as string,
    date: row.date as string,
    startTime: row.start_time as string,
    endTime: (row.end_time as string) ?? null,
    duration: (row.duration_ms as number) ?? null,
    note: (row.note as string) ?? '',
    // v2 tagging fields
    projectId: (row.project_id as string) ?? null,
    valueCategory: (row.value_category as string) ?? null,
    workStyle: (row.work_style as string) ?? null,
    outputType: (row.output_type as string) ?? null,
    sessionStatus: (row.session_status as string) ?? 'In Progress',
    isCompleted: (row.is_completed as boolean) ?? false,
    completionNote: (row.completion_note as string) ?? '',
    nextSteps: (row.next_steps as string) ?? '',
    blockedBy: (row.blocked_by as string) ?? '',
    carryForward: (row.carry_forward as boolean) ?? false,
  };
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
    // v2 tagging fields
    project_id: e.projectId ?? null,
    value_category: e.valueCategory ?? null,
    work_style: e.workStyle ?? null,
    output_type: e.outputType ?? null,
    session_status: e.sessionStatus ?? 'In Progress',
    is_completed: e.isCompleted ?? false,
    completion_note: e.completionNote ?? '',
    next_steps: e.nextSteps ?? '',
    blocked_by: e.blockedBy ?? '',
    carry_forward: e.carryForward ?? false,
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
    autoEmailEnabled: data.auto_email_enabled ?? false,
    autoEmailRecipient: data.auto_email_recipient ?? '',
    autoEmailTime: data.auto_email_time ?? '17:00',
    autoEmailMinHours: data.auto_email_min_hours ?? 8,
    autoEmailMaxGapMin: data.auto_email_max_gap_min ?? 120,
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
      auto_email_enabled: settings.autoEmailEnabled,
      auto_email_recipient: settings.autoEmailRecipient,
      auto_email_time: settings.autoEmailTime,
      auto_email_min_hours: settings.autoEmailMinHours,
      auto_email_max_gap_min: settings.autoEmailMaxGapMin,
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

// ---- Tag Options ----

export async function loadTagOptions(userId: string): Promise<TagOption[]> {
  const { data, error } = await supabase
    .from('user_tag_options')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('sort_order');

  if (error) {
    console.error('Failed to load tag options:', error.message);
    return [];
  }

  return (data ?? []).map(row => ({
    id: row.id,
    userId: row.user_id,
    category: row.category,
    value: row.value,
    color: row.color,
    sortOrder: row.sort_order,
    isDefault: row.is_default,
    isArchived: row.is_archived,
    createdAt: row.created_at,
  }));
}

export async function saveTagOption(option: TagOption): Promise<void> {
  const { error } = await supabase
    .from('user_tag_options')
    .upsert({
      id: option.id,
      user_id: option.userId,
      category: option.category,
      value: option.value,
      color: option.color,
      sort_order: option.sortOrder,
      is_default: option.isDefault,
      is_archived: option.isArchived,
    }, { onConflict: 'id' });

  if (error) console.error('Failed to save tag option:', error.message);
}

export async function deleteTagOption(optionId: string): Promise<void> {
  // Archive instead of hard delete
  const { error } = await supabase
    .from('user_tag_options')
    .update({ is_archived: true })
    .eq('id', optionId);

  if (error) console.error('Failed to archive tag option:', error.message);
}
