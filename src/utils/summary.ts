// ============================================================
// Summary generation utilities — plain text, CSV, email
// v2: includes project breakdowns, value categories, status sections
// ============================================================

import type { TimeEntry, Settings, Task } from '../types';
import { formatDurationShort, formatTime, formatDateLong } from './time';

interface SummaryData {
  date: string;
  entries: TimeEntry[];
  tasks: Task[];
  settings: Settings;
  dailyNote: string;
}

// ---- Aggregation Helpers ----

export function getTaskTotals(
  entries: TimeEntry[],
  tasks: Task[]
): { taskId: string; taskName: string; totalMs: number; color: string }[] {
  const totals: Record<string, { taskName: string; totalMs: number; color: string }> = {};

  for (const entry of entries) {
    if (!entry.endTime) continue;
    const dur = entry.duration ?? 0;
    if (!totals[entry.taskId]) {
      const task = tasks.find(t => t.id === entry.taskId);
      totals[entry.taskId] = {
        taskName: entry.taskName,
        totalMs: 0,
        color: task?.color ?? '#607D8B',
      };
    }
    totals[entry.taskId].totalMs += dur;
  }

  return Object.entries(totals)
    .map(([taskId, data]) => ({ taskId, ...data }))
    .sort((a, b) => b.totalMs - a.totalMs);
}

export function getProjectTotals(
  entries: TimeEntry[]
): { project: string; totalMs: number }[] {
  const totals: Record<string, number> = {};

  for (const entry of entries) {
    if (!entry.endTime) continue;
    const key = entry.projectId || 'Untagged';
    totals[key] = (totals[key] ?? 0) + (entry.duration ?? 0);
  }

  return Object.entries(totals)
    .map(([project, totalMs]) => ({ project, totalMs }))
    .sort((a, b) => b.totalMs - a.totalMs);
}

export function getValueCategoryTotals(
  entries: TimeEntry[]
): { category: string; totalMs: number; color: string }[] {
  const totals: Record<string, number> = {};

  for (const entry of entries) {
    if (!entry.endTime) continue;
    const key = entry.valueCategory || 'Untagged';
    totals[key] = (totals[key] ?? 0) + (entry.duration ?? 0);
  }

  const CATEGORY_COLORS: Record<string, string> = {
    'Revenue': '#50B86C',
    'Growth': '#4A90D9',
    'Operations': '#F5A623',
    'Support': '#00BCD4',
    'Strategy': '#9B59B6',
    'Compliance': '#FF7043',
    'Unrealized Effort': '#607D8B',
    'Untagged': '#999',
  };

  return Object.entries(totals)
    .map(([category, totalMs]) => ({
      category,
      totalMs,
      color: CATEGORY_COLORS[category] || '#607D8B',
    }))
    .sort((a, b) => b.totalMs - a.totalMs);
}

export interface StatusGroups {
  completed: TimeEntry[];
  inProgress: TimeEntry[];
  followUp: TimeEntry[];  // Waiting for Review, Waiting for Approval, Blocked, Deferred
  shelved: TimeEntry[];   // Shelved, Scrapped
}

export function getEntriesByStatus(entries: TimeEntry[]): StatusGroups {
  const done = entries.filter(e => e.endTime);
  return {
    completed: done.filter(e => e.isCompleted),
    inProgress: done.filter(e => !e.isCompleted && (e.sessionStatus === 'In Progress' || !e.sessionStatus)),
    followUp: done.filter(e => ['Waiting for Review', 'Waiting for Approval', 'Blocked', 'Deferred'].includes(e.sessionStatus)),
    shelved: done.filter(e => ['Shelved', 'Scrapped'].includes(e.sessionStatus)),
  };
}

export function getStatusCounts(entries: TimeEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    if (!e.endTime) continue;
    const status = e.isCompleted ? 'Completed' : (e.sessionStatus || 'In Progress');
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

// Grand total tracked time
export function getGrandTotal(entries: TimeEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.duration ?? 0), 0);
}

// Detect untracked gaps between sessions
export function getGapTime(entries: TimeEntry[]): number {
  if (entries.length < 2) return 0;

  const sorted = [...entries]
    .filter(e => e.endTime)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  let gapMs = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = new Date(sorted[i - 1].endTime!).getTime();
    const nextStart = new Date(sorted[i].startTime).getTime();
    if (nextStart > prevEnd) {
      gapMs += nextStart - prevEnd;
    }
  }
  return gapMs;
}

// ---- Value Breakdown ----

export function getValueBreakdown(entries: TimeEntry[]): {
  completedMs: number;
  inProgressMs: number;
  unrealizedMs: number;
} {
  let completedMs = 0;
  let inProgressMs = 0;
  let unrealizedMs = 0;

  for (const e of entries) {
    if (!e.endTime) continue;
    const dur = e.duration ?? 0;

    if (e.valueCategory === 'Unrealized Effort' || ['Shelved', 'Scrapped'].includes(e.sessionStatus)) {
      unrealizedMs += dur;
    } else if (e.isCompleted) {
      completedMs += dur;
    } else {
      inProgressMs += dur;
    }
  }

  return { completedMs, inProgressMs, unrealizedMs };
}

// ---- Email Summary (v2 with proof-of-value sections) ----

export function generateEmailSummary(data: SummaryData): string {
  const { date, entries, settings, dailyNote } = data;
  const tf = settings.timeFormat;
  const done = entries.filter(e => e.endTime);
  const grandTotal = getGrandTotal(entries);
  const projectTotals = getProjectTotals(entries);
  const valueTotals = getValueCategoryTotals(entries);
  const groups = getEntriesByStatus(entries);

  const subject = settings.emailSubjectFormat.replace('{date}', formatDateLong(date));

  const lines: string[] = [];
  lines.push(`Subject: ${subject}`);
  lines.push('');
  lines.push(settings.greeting.replace('{boss}', settings.bossName));
  lines.push('');

  // -- Time by Project --
  if (projectTotals.length > 0) {
    lines.push('Time by Project:');
    projectTotals.forEach(p => {
      lines.push(`- ${p.project}: ${formatDurationShort(p.totalMs)}`);
    });
    lines.push('');
  }

  // -- Value Breakdown --
  if (valueTotals.length > 0) {
    lines.push('Value Breakdown:');
    valueTotals.forEach(v => {
      lines.push(`- ${v.category}: ${formatDurationShort(v.totalMs)}`);
    });
    lines.push('');
  }

  // -- Completed --
  if (groups.completed.length > 0) {
    lines.push('Completed:');
    groups.completed.forEach((e, i) => {
      const project = e.projectId ? ` (${e.projectId})` : '';
      const note = e.completionNote || e.note || '';
      lines.push(`${i + 1}. ${e.taskName}${project}${note ? ` — ${note}` : ''}`);
      if (e.outputType) {
        lines.push(`   Output: ${e.outputType}`);
      }
    });
    lines.push('');
  }

  // -- In Progress --
  if (groups.inProgress.length > 0) {
    lines.push('In Progress:');
    groups.inProgress.forEach((e, i) => {
      const project = e.projectId ? ` (${e.projectId})` : '';
      const note = e.note || '';
      lines.push(`${i + 1}. ${e.taskName}${project}${note ? ` — ${note}` : ''}`);
    });
    lines.push('');
  }

  // -- Needs Follow-up / Pass-off --
  if (groups.followUp.length > 0) {
    lines.push('Needs Follow-up / Pass-off:');
    groups.followUp.forEach(e => {
      const project = e.projectId ? `${e.projectId} / ` : '';
      lines.push(`- ${project}${e.taskName} — ${e.sessionStatus}`);
      if (e.nextSteps) lines.push(`  Next step: ${e.nextSteps}`);
      if (e.blockedBy) lines.push(`  Waiting on: ${e.blockedBy}`);
    });
    lines.push('');
  }

  // -- Shelved / Scrapped / Unrealized Effort --
  if (groups.shelved.length > 0) {
    lines.push('Shelved / Scrapped / Unrealized Effort:');
    groups.shelved.forEach(e => {
      const dur = e.duration ? ` — ${formatDurationShort(e.duration)}` : '';
      const project = e.projectId ? `${e.projectId} / ` : '';
      lines.push(`- ${project}${e.taskName}${dur}`);
      const note = e.completionNote || e.note;
      if (note) lines.push(`  Note: ${note}`);
    });
    lines.push('');
  }

  // -- Detailed Log --
  lines.push('Detailed Log:');
  const sorted = [...done]
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  sorted.forEach((entry, i) => {
    const start = formatTime(entry.startTime, tf);
    const end = formatTime(entry.endTime!, tf);
    const note = entry.note ? ` — ${entry.note}` : '';
    lines.push(`${i + 1}. ${start} – ${end}: ${entry.taskName}${note}`);
  });
  lines.push('');

  lines.push(`Total tracked time: ${formatDurationShort(grandTotal)}`);
  lines.push('');

  if (dailyNote) {
    lines.push(`Notes: ${dailyNote}`);
    lines.push('');
  }

  lines.push(settings.signoff.replace('{name}', settings.myName));

  return lines.join('\n');
}

// Generate plain text summary
export function generatePlainTextSummary(data: SummaryData): string {
  const { date, entries, tasks, dailyNote } = data;
  const taskTotals = getTaskTotals(entries, tasks);
  const grandTotal = getGrandTotal(entries);
  const gapTime = getGapTime(entries);
  const tf = data.settings.timeFormat;

  const lines: string[] = [];
  lines.push(`Work Summary — ${formatDateLong(date)}`);
  lines.push('═'.repeat(50));
  lines.push('');

  lines.push('Time by Task:');
  taskTotals.forEach((t, i) => {
    lines.push(`  ${i + 1}. ${t.taskName}: ${formatDurationShort(t.totalMs)}`);
  });
  lines.push('');

  lines.push('Detailed Log:');
  const sorted = [...entries]
    .filter(e => e.endTime)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  sorted.forEach((entry, i) => {
    const start = formatTime(entry.startTime, tf);
    const end = formatTime(entry.endTime!, tf);
    const note = entry.note ? ` — ${entry.note}` : '';
    lines.push(`  ${i + 1}. ${start} – ${end}: ${entry.taskName}${note}`);
  });
  lines.push('');

  lines.push(`Total tracked time: ${formatDurationShort(grandTotal)}`);
  if (gapTime > 0) {
    lines.push(`Untracked gap time: ${formatDurationShort(gapTime)}`);
  }

  if (dailyNote) {
    lines.push('');
    lines.push(`Notes: ${dailyNote}`);
  }

  return lines.join('\n');
}

// Generate CSV export
export function generateCSV(entries: TimeEntry[], tf: '12h' | '24h'): string {
  const header = 'Task,Project,Value Category,Work Style,Status,Start Time,End Time,Duration (min),Note';
  const rows = [...entries]
    .filter(e => e.endTime)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .map(e => {
      const durationMin = Math.round((e.duration ?? 0) / 60000);
      const esc = (s: string | null) => `"${(s || '').replace(/"/g, '""')}"`;
      return `${esc(e.taskName)},${esc(e.projectId)},${esc(e.valueCategory)},${esc(e.workStyle)},${esc(e.sessionStatus)},${esc(formatTime(e.startTime, tf))},${esc(formatTime(e.endTime!, tf))},${durationMin},${esc(e.note)}`;
    });

  return [header, ...rows].join('\n');
}

// Copy text to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  }
}

// Download text as a file
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
