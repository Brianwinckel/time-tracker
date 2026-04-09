// ============================================================
// Main tracker dashboard screen
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { TaskGrid } from './TaskGrid';
import { ActiveTaskBar } from './ActiveTaskBar';
import { SessionLog } from './SessionLog';
import { DailyNote } from './DailyNote';
import { ManualEntryForm } from './ManualEntryForm';
import { EndMyDay } from './EndMyDay';
import { SessionOutcomeModal } from './SessionOutcomeModal';
import type { TimeEntry } from '../types';

export const Dashboard: React.FC = () => {
  const { state } = useApp();
  const [showEndOfDay, setShowEndOfDay] = useState(false);
  const [outcomeEntry, setOutcomeEntry] = useState<TimeEntry | null>(null);
  const prevActiveRef = useRef<string | null>(null);

  // Detect when active entry transitions from active → stopped
  useEffect(() => {
    const prevId = prevActiveRef.current;
    prevActiveRef.current = state.activeEntryId;

    // If we had an active entry and now it's gone, show the outcome modal
    if (prevId && !state.activeEntryId) {
      const endedEntry = state.entries.find(e => e.id === prevId);
      if (endedEntry?.endTime) {
        setOutcomeEntry(endedEntry);
      }
    }
  }, [state.activeEntryId, state.entries]);

  if (state.loading) {
    return <div className="loading-screen" role="status" aria-busy="true">Loading your tasks...</div>;
  }

  const hasEntries = state.entries.filter(e => e.endTime).length > 0;

  return (
    <div className="dashboard">
      <ActiveTaskBar />
      <TaskGrid />

      {hasEntries && (
        <button
          className="end-my-day-btn"
          onClick={() => setShowEndOfDay(true)}
        >
          End My Day
        </button>
      )}

      <div className="dashboard__bottom">
        <SessionLog />
        <div className="dashboard__sidebar">
          <DailyNote />
          <ManualEntryForm />
        </div>
      </div>

      {showEndOfDay && (
        <EndMyDay onClose={() => setShowEndOfDay(false)} />
      )}

      {outcomeEntry && (
        <SessionOutcomeModal
          entry={outcomeEntry}
          onClose={() => setOutcomeEntry(null)}
        />
      )}
    </div>
  );
};
