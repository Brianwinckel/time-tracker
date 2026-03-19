// ============================================================
// Daily notes text area
// ============================================================

import React from 'react';
import { useApp } from '../context/AppContext';

export const DailyNote: React.FC = () => {
  const { state, dispatch } = useApp();

  return (
    <div className="daily-note">
      <h3>Daily Notes</h3>
      <textarea
        value={state.dailyNote}
        onChange={e => dispatch({ type: 'SET_DAILY_NOTE', note: e.target.value })}
        placeholder="Notes for today..."
        rows={3}
      />
    </div>
  );
};
