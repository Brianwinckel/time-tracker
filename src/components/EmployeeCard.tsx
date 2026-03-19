// ============================================================
// Employee status card — shows name, active task, today's total
// Used in the Manager Dashboard
// ============================================================

import React from 'react';
import type { TimeEntry } from '../types';
import { formatDuration, formatDurationShort, elapsedSince } from '../utils/time';
import { useTimer } from '../hooks/useTimer';

interface Props {
  name: string;
  email: string;
  entries: TimeEntry[];
  onClick?: () => void;
}

// Sub-component for the live timer on active entries
const LiveDuration: React.FC<{ startTime: string }> = ({ startTime }) => {
  const elapsed = useTimer(startTime);
  return <span>{formatDuration(elapsed)}</span>;
};

export const EmployeeCard: React.FC<Props> = ({ name, email, entries, onClick }) => {
  const activeEntry = entries.find(e => !e.endTime);
  const completedEntries = entries.filter(e => e.endTime);
  const totalMs = completedEntries.reduce((sum, e) => sum + (e.duration ?? 0), 0);

  // Count of sessions today
  const sessionCount = completedEntries.length + (activeEntry ? 1 : 0);

  return (
    <div
      className={`employee-card ${activeEntry ? 'employee-card--active' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="employee-card__header">
        <div className="employee-card__status">
          <span className={`employee-card__dot ${activeEntry ? 'employee-card__dot--active' : ''}`} />
          <span className="employee-card__name">{name || email}</span>
        </div>
        {sessionCount > 0 && (
          <span className="employee-card__sessions">{sessionCount} sessions</span>
        )}
      </div>

      {activeEntry ? (
        <div className="employee-card__active">
          <span className="employee-card__task-name">{activeEntry.taskName}</span>
          {activeEntry.note && (
            <span className="employee-card__task-note">{activeEntry.note}</span>
          )}
          <span className="employee-card__timer">
            <LiveDuration startTime={activeEntry.startTime} />
          </span>
        </div>
      ) : (
        <div className="employee-card__idle">
          <span>No active task</span>
        </div>
      )}

      <div className="employee-card__footer">
        <span className="employee-card__total">
          Today: {formatDurationShort(totalMs)}
        </span>
      </div>
    </div>
  );
};
