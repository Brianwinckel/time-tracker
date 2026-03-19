// ============================================================
// Main tracker dashboard screen
// ============================================================

import React from 'react';
import { useApp } from '../context/AppContext';
import { TaskGrid } from './TaskGrid';
import { ActiveTaskBar } from './ActiveTaskBar';
import { SessionLog } from './SessionLog';
import { DailyNote } from './DailyNote';
import { ManualEntryForm } from './ManualEntryForm';

export const Dashboard: React.FC = () => {
  const { state } = useApp();

  if (state.loading) {
    return <div className="loading-screen">Loading your tasks...</div>;
  }

  return (
    <div className="dashboard">
      <ActiveTaskBar />
      <TaskGrid />
      <div className="dashboard__bottom">
        <SessionLog />
        <div className="dashboard__sidebar">
          <DailyNote />
          <ManualEntryForm />
        </div>
      </div>
    </div>
  );
};
