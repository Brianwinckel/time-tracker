// ============================================================
// Main tracker dashboard screen
// ============================================================

import React from 'react';
import { TaskGrid } from './TaskGrid';
import { ActiveTaskBar } from './ActiveTaskBar';
import { SessionLog } from './SessionLog';
import { DailyNote } from './DailyNote';
import { ManualEntryForm } from './ManualEntryForm';

export const Dashboard: React.FC = () => {
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
