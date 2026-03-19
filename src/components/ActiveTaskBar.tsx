// ============================================================
// Sticky bar showing the currently active task + live timer
// ============================================================

import React from 'react';
import { useApp } from '../context/AppContext';
import { useTimer } from '../hooks/useTimer';
import { formatDuration } from '../utils/time';

export const ActiveTaskBar: React.FC = () => {
  const { state, dispatch, getActiveEntry } = useApp();
  const activeEntry = getActiveEntry();
  const elapsed = useTimer(activeEntry?.startTime ?? null);
  const task = state.tasks.find(t => t.id === activeEntry?.taskId);
  const lastTask = state.tasks.find(t => t.id === state.lastTaskId);

  return (
    <div className="active-bar">
      {activeEntry && task ? (
        <>
          <div className="active-bar__indicator" style={{ backgroundColor: task.color }} />
          <div className="active-bar__info">
            <span className="active-bar__label">Active:</span>
            <span className="active-bar__task">{task.name}</span>
            <span className="active-bar__timer">{formatDuration(elapsed)}</span>
          </div>
          <button
            className="btn btn--stop"
            onClick={() => dispatch({ type: 'STOP_TASK' })}
            title="Stop (Esc)"
          >
            &#9632; Stop
          </button>
        </>
      ) : (
        <>
          <div className="active-bar__info">
            <span className="active-bar__label active-bar__label--idle">
              No active task
            </span>
          </div>
          {lastTask && (
            <button
              className="btn btn--resume"
              onClick={() => dispatch({ type: 'RESUME_LAST_TASK' })}
              title="Resume last task (R)"
            >
              &#9654; Resume {lastTask.name}
            </button>
          )}
        </>
      )}
    </div>
  );
};
