// ============================================================
// V6 Daily Summary Screen — polished end-of-day report
// Layout: s3-timeline-story concept + s6-modern-data AI card
// Lives inside AppShell (no sidebar/bottom-tabs here)
// ============================================================

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { formatDuration, formatTime, formatDateLong } from '../../utils/time';
import { formatDurationShort } from '../../utils/time';
import { getTaskTotals, getGrandTotal, generatePlainTextSummary, generateEmailSummary, generateCSV, copyToClipboard, downloadFile } from '../../utils/summary';
import type { TimeEntry } from '../../types';

// ---- Donut Chart (SVG) ----

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

const DonutChart: React.FC<{ segments: DonutSegment[]; size?: number }> = ({ segments, size = 180 }) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <svg width={size} height={size} viewBox="0 0 180 180" className="mx-auto">
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dashLength = pct * circumference;
        const dashOffset = -(accumulated * circumference);
        accumulated += pct;

        return (
          <circle
            key={i}
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="24"
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-500"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '90px 90px' }}
          />
        );
      })}
      {/* Center text */}
      <text x="90" y="85" textAnchor="middle" className="fill-slate-700 text-lg font-semibold" fontSize="18">
        {formatDurationShort(total)}
      </text>
      <text x="90" y="105" textAnchor="middle" className="fill-slate-400 text-xs" fontSize="12">
        total
      </text>
    </svg>
  );
};

// ---- Productivity Flow (SVG line chart placeholder) ----

const ProductivityFlow: React.FC<{ entries: TimeEntry[] }> = ({ entries }) => {
  // Build hourly activity buckets (6am-10pm)
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);
  const buckets = hours.map(h => {
    const ms = entries
      .filter(e => e.endTime && e.duration)
      .reduce((sum, e) => {
        const start = new Date(e.startTime);
        const end = new Date(e.endTime!);
        // Overlap with this hour bucket
        const bucketStart = new Date(start);
        bucketStart.setHours(h, 0, 0, 0);
        const bucketEnd = new Date(start);
        bucketEnd.setHours(h + 1, 0, 0, 0);
        const overlapStart = Math.max(start.getTime(), bucketStart.getTime());
        const overlapEnd = Math.min(end.getTime(), bucketEnd.getTime());
        return sum + Math.max(0, overlapEnd - overlapStart);
      }, 0);
    return ms;
  });

  const maxBucket = Math.max(...buckets, 1);
  const width = 320;
  const height = 100;
  const padding = { top: 10, right: 10, bottom: 20, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = buckets.map((val, i) => {
    const x = padding.left + (i / (buckets.length - 1)) * chartW;
    const y = padding.top + chartH - (val / maxBucket) * chartH;
    return `${x},${y}`;
  });

  const areaPoints = [
    `${padding.left},${padding.top + chartH}`,
    ...points,
    `${padding.left + chartW},${padding.top + chartH}`,
  ].join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <polygon points={areaPoints} fill="url(#flowGrad)" />
      {/* Line */}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Hour labels */}
      {hours.filter((_, i) => i % 4 === 0).map((h, i) => {
        const x = padding.left + ((h - 6) / (hours.length - 1)) * chartW;
        const label = h <= 12 ? `${h}${h < 12 ? 'a' : 'p'}` : `${h - 12}p`;
        return (
          <text key={i} x={x} y={height - 4} textAnchor="middle" fontSize="9" className="fill-slate-400">
            {label}
          </text>
        );
      })}
    </svg>
  );
};

// ---- Main Component ----

export const DailySummaryScreen: React.FC = () => {
  const { state } = useApp();
  const [copied, setCopied] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  // ---- Compute data ----

  const completedEntries = useMemo(
    () => state.entries.filter(e => e.endTime),
    [state.entries]
  );

  const taskTotals = useMemo(
    () => getTaskTotals(completedEntries, state.tasks),
    [completedEntries, state.tasks]
  );

  const grandTotal = useMemo(
    () => getGrandTotal(completedEntries),
    [completedEntries]
  );

  const timeline = useMemo(
    () =>
      [...completedEntries].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
    [completedEntries]
  );

  const taskColorMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {};
    for (const t of state.tasks) {
      map[t.id] = { name: t.name, color: t.color };
    }
    return map;
  }, [state.tasks]);

  const tf = state.settings.timeFormat;

  // ---- Scorecard stats ----

  const tasksCompleted = useMemo(
    () => new Set(completedEntries.filter(e => e.isCompleted).map(e => e.taskId)).size,
    [completedEntries]
  );

  const focusScore = useMemo(() => {
    if (completedEntries.length === 0) return 0;
    const totalMs = completedEntries.reduce((s, e) => s + (e.duration ?? 0), 0);
    // Focus score: ratio of longest-task time to total, scaled to 100
    const longest = taskTotals.length > 0 ? taskTotals[0].totalMs : 0;
    return totalMs > 0 ? Math.round((longest / totalMs) * 100) : 0;
  }, [completedEntries, taskTotals]);

  const bestStreak = useMemo(() => {
    if (timeline.length === 0) return '0m';
    // Best streak = longest consecutive tracking without a gap > 5min
    let maxStreak = 0;
    let currentStreak = 0;
    for (let i = 0; i < timeline.length; i++) {
      currentStreak += timeline[i].duration ?? 0;
      if (i < timeline.length - 1) {
        const gap =
          new Date(timeline[i + 1].startTime).getTime() -
          new Date(timeline[i].endTime!).getTime();
        if (gap > 5 * 60 * 1000) {
          maxStreak = Math.max(maxStreak, currentStreak);
          currentStreak = 0;
        }
      }
    }
    maxStreak = Math.max(maxStreak, currentStreak);
    return formatDurationShort(maxStreak);
  }, [timeline]);

  // ---- AI Story (placeholder) ----

  const storyText = useMemo(() => {
    if (taskTotals.length === 0) return null;
    const parts: { text: string; color?: string }[] = [];
    parts.push({ text: 'You started your day at ' });
    if (timeline.length > 0) {
      parts.push({ text: formatTime(timeline[0].startTime, tf) });
    }
    parts.push({ text: ' with ' });
    const first = taskColorMap[timeline[0]?.taskId];
    if (first) {
      parts.push({ text: first.name, color: first.color });
    }
    parts.push({ text: '. ' });

    if (taskTotals.length > 1) {
      parts.push({ text: 'Your biggest focus was ' });
      parts.push({ text: taskTotals[0].taskName, color: taskTotals[0].color });
      parts.push({
        text: ` at ${formatDurationShort(taskTotals[0].totalMs)}. `,
      });
      parts.push({ text: 'You also spent time on ' });
      parts.push({ text: taskTotals[1].taskName, color: taskTotals[1].color });
      parts.push({
        text: ` (${formatDurationShort(taskTotals[1].totalMs)})`,
      });
      if (taskTotals.length > 2) {
        parts.push({ text: ' and ' });
        parts.push({ text: taskTotals[2].taskName, color: taskTotals[2].color });
        parts.push({
          text: ` (${formatDurationShort(taskTotals[2].totalMs)})`,
        });
      }
      parts.push({ text: '. ' });
    }

    if (timeline.length > 0) {
      parts.push({ text: 'Your last session ended at ' });
      parts.push({
        text: formatTime(timeline[timeline.length - 1].endTime!, tf),
      });
      parts.push({ text: '.' });
    }

    parts.push({
      text: ` Overall, you tracked ${formatDurationShort(grandTotal)} across ${completedEntries.length} sessions. `,
    });

    if (focusScore >= 70) {
      parts.push({ text: 'Great focus today — you stayed locked in!' });
    } else if (focusScore >= 40) {
      parts.push({ text: 'A well-balanced day with good variety.' });
    } else {
      parts.push({
        text: 'Lots of context switching today — consider batching similar tasks tomorrow.',
      });
    }

    return parts;
  }, [taskTotals, timeline, taskColorMap, tf, grandTotal, completedEntries.length, focusScore]);

  // ---- Export handlers ----

  const summaryData = useMemo(
    () => ({
      date: state.currentDate,
      entries: completedEntries,
      tasks: state.tasks,
      settings: state.settings,
      dailyNote: state.dailyNote,
    }),
    [state.currentDate, completedEntries, state.tasks, state.settings, state.dailyNote]
  );

  const handleCopy = async () => {
    const text = generatePlainTextSummary(summaryData);
    await copyToClipboard(text);
    setCopied('plain');
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(null), 2000);
  };

  const handleEmail = () => {
    const emailText = generateEmailSummary(summaryData);
    const subjectMatch = emailText.match(/^Subject: (.+)$/m);
    const subject = subjectMatch
      ? subjectMatch[1]
      : `Daily Work Summary - ${formatDateLong(state.currentDate)}`;
    const body = emailText.replace(/^Subject: .+\n\n?/, '');
    const recipients = (state.settings.autoEmailRecipient || '')
      .split(',')
      .map(e => e.trim())
      .filter(Boolean)
      .join(',');
    window.open(
      `mailto:${encodeURIComponent(recipients)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      '_blank'
    );
  };

  const handleDownload = () => {
    const csv = generateCSV(completedEntries, tf);
    downloadFile(csv, `time-tracking-${state.currentDate}.csv`, 'text/csv');
  };

  // ---- Empty state ----

  if (completedEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-700 mb-1">No sessions yet</h2>
        <p className="text-sm text-slate-400">Complete some work sessions and your daily summary will appear here.</p>
      </div>
    );
  }

  // ---- Render ----

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Logo icon */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Daily Work Summary</h1>
            <p className="text-sm text-slate-400">{formatDateLong(state.currentDate)}</p>
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            title="Copy summary"
          >
            {copied === 'plain' ? (
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
            <span className="hidden sm:inline">{copied === 'plain' ? 'Copied!' : 'Copy'}</span>
          </button>
          <button
            onClick={handleEmail}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            title="Email summary"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Email</span>
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            title="Download CSV"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* ---- Desktop 5-column grid / Mobile single column ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ======== LEFT COLUMN (3 cols) ======== */}
        <div className="lg:col-span-3 space-y-6">

          {/* -- Day Composition (Donut) -- */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Day Composition</h2>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <DonutChart
                segments={taskTotals.map(t => ({
                  label: t.taskName,
                  value: t.totalMs,
                  color: t.color,
                }))}
              />
              {/* Legend */}
              <div className="flex-1 space-y-2 min-w-0">
                {taskTotals.map(t => {
                  const pct = grandTotal > 0 ? Math.round((t.totalMs / grandTotal) * 100) : 0;
                  return (
                    <div key={t.taskId} className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="text-sm text-slate-700 truncate flex-1">{t.taskName}</span>
                      <span className="text-sm font-medium text-slate-500 tabular-nums">
                        {formatDurationShort(t.totalMs)}
                      </span>
                      <span className="text-xs text-slate-400 w-8 text-right tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* -- Timeline -- */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Timeline</h2>
            <div className="relative pl-8">
              {/* Vertical line */}
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200 rounded-full" />

              <div className="space-y-4">
                {timeline.map((entry, i) => {
                  const task = taskColorMap[entry.taskId];
                  const color = task?.color ?? '#607D8B';
                  const dur = entry.duration ?? 0;
                  const pct = grandTotal > 0 ? Math.round((dur / grandTotal) * 100) : 0;

                  return (
                    <div key={entry.id} className="relative flex items-start gap-3">
                      {/* Dot on the line */}
                      <div
                        className="absolute -left-5 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm shrink-0"
                        style={{ backgroundColor: color }}
                      />

                      {/* Time label */}
                      <div className="text-xs text-slate-400 font-medium tabular-nums w-14 pt-0.5 shrink-0">
                        {formatTime(entry.startTime, tf)}
                      </div>

                      {/* Session card */}
                      <div
                        className="flex-1 rounded-xl p-3 border transition-colors"
                        style={{
                          borderColor: color + '30',
                          backgroundColor: color + '08',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-semibold text-slate-700">{entry.taskName}</span>
                          <span className="text-xs text-slate-500 tabular-nums shrink-0">
                            {formatDuration(dur)}
                          </span>
                        </div>
                        {entry.note && (
                          <p className="text-xs text-slate-500 mb-2 line-clamp-2">{entry.note}</p>
                        )}
                        {/* Progress bar */}
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ======== RIGHT COLUMN (2 cols) ======== */}
        <div className="lg:col-span-2 space-y-6">

          {/* -- AI Summary / Story of Your Day (s6-modern-data dark card) -- */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg">
            {/* Header badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
                </svg>
              </span>
              <span className="text-sm font-semibold text-slate-200">AI Summary</span>
            </div>
            <h3 className="text-base font-bold text-white mb-3">Story of Your Day</h3>
            {storyText && (
              <p className="text-sm leading-relaxed text-slate-300">
                {storyText.map((part, i) =>
                  part.color ? (
                    <span key={i} className="font-semibold" style={{ color: part.color }}>
                      {part.text}
                    </span>
                  ) : (
                    <span key={i}>{part.text}</span>
                  )
                )}
              </p>
            )}
          </div>

          {/* -- Productivity Flow -- */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Productivity Flow</h2>
            <ProductivityFlow entries={completedEntries} />
          </div>

          {/* -- End-of-Day Scorecard (2x2 grid) -- */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">End-of-Day Scorecard</h2>
            <div className="grid grid-cols-2 gap-4">
              {/* Total Focus */}
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 tabular-nums">
                  {formatDurationShort(grandTotal)}
                </div>
                <div className="text-xs text-blue-500 font-medium mt-1">Total Focus</div>
              </div>
              {/* Tasks Done */}
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-600 tabular-nums">
                  {tasksCompleted}
                </div>
                <div className="text-xs text-green-500 font-medium mt-1">Tasks Done</div>
              </div>
              {/* Focus Score */}
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-purple-600 tabular-nums">
                  {focusScore}%
                </div>
                <div className="text-xs text-purple-500 font-medium mt-1">Focus Score</div>
              </div>
              {/* Best Streak */}
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-amber-600 tabular-nums">
                  {bestStreak}
                </div>
                <div className="text-xs text-amber-500 font-medium mt-1">Best Streak</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
