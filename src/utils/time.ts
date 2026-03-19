// ============================================================
// Time formatting and calculation utilities
// ============================================================

// Format milliseconds as "Xh Ym" or "Xm Ys"
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

// Format duration for summary display: "1h 10m"
export function formatDurationShort(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

// Format a timestamp as "8:02 AM" or "14:02"
export function formatTime(isoString: string, format: '12h' | '24h'): string {
  const date = new Date(isoString);
  if (format === '24h') {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Format a date as "Monday, March 19, 2026"
export function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Format as "Mar 19, 2026"
export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Get today as YYYY-MM-DD in local time
export function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Calculate duration between two ISO timestamps
export function calcDuration(start: string, end: string): number {
  return new Date(end).getTime() - new Date(start).getTime();
}

// Get elapsed ms from a start time to now
export function elapsedSince(start: string): number {
  return Date.now() - new Date(start).getTime();
}
