// ============================================================
// Summary generation utilities — plain text, CSV, email
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

// Aggregate time per task
export function getTaskTotals(
  entries: TimeEntry[],
  tasks: Task[]
): { taskId: string; taskName: string; totalMs: number; color: string }[] {
  const totals: Record<string, { taskName: string; totalMs: number; color: string }> = {};

  for (const entry of entries) {
    if (!entry.endTime) continue; // skip running entries
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

  // Task totals
  lines.push('Time by Task:');
  taskTotals.forEach((t, i) => {
    lines.push(`  ${i + 1}. ${t.taskName}: ${formatDurationShort(t.totalMs)}`);
  });
  lines.push('');

  // Chronological log
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

// Generate email-ready summary
export function generateEmailSummary(data: SummaryData): string {
  const { date, entries, tasks, settings, dailyNote } = data;
  const taskTotals = getTaskTotals(entries, tasks);
  const grandTotal = getGrandTotal(entries);
  const tf = settings.timeFormat;

  const subject = settings.emailSubjectFormat
    .replace('{date}', formatDateLong(date));

  const lines: string[] = [];
  lines.push(`Subject: ${subject}`);
  lines.push('');
  lines.push(settings.greeting.replace('{boss}', settings.bossName));
  lines.push('');
  lines.push('Here is my work summary for today:');
  lines.push('');

  taskTotals.forEach((t, i) => {
    lines.push(`${i + 1}. ${t.taskName}: ${formatDurationShort(t.totalMs)}`);
  });
  lines.push('');

  lines.push('Detailed log:');
  const sorted = [...entries]
    .filter(e => e.endTime)
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

// Generate CSV export
export function generateCSV(entries: TimeEntry[], tf: '12h' | '24h'): string {
  const header = 'Task,Start Time,End Time,Duration (min),Note';
  const rows = [...entries]
    .filter(e => e.endTime)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .map(e => {
      const durationMin = Math.round((e.duration ?? 0) / 60000);
      const note = (e.note || '').replace(/"/g, '""');
      return `"${e.taskName}","${formatTime(e.startTime, tf)}","${formatTime(e.endTime!, tf)}",${durationMin},"${note}"`;
    });

  return [header, ...rows].join('\n');
}

// Copy text to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
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
