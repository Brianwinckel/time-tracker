// ============================================================
// Sticky bar showing the currently active task + live timer
// Includes inline tag selectors for project + value category
// ============================================================

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTimer } from '../hooks/useTimer';
import { formatDuration } from '../utils/time';
import { TagSelector } from './TagSelector';

export const ActiveTaskBar: React.FC = () => {
  const { state, dispatch, getActiveEntry } = useApp();
  const activeEntry = getActiveEntry();
  const elapsed = useTimer(activeEntry?.startTime ?? null);
  const task = state.tasks.find(t => t.id === activeEntry?.taskId);
  const lastTask = state.tasks.find(t => t.id === state.lastTaskId);
  const [tagsOpen, setTagsOpen] = useState(false);

  const handleTagChange = (field: string, value: string | null) => {
    if (!activeEntry) return;
    dispatch({
      type: 'SET_ENTRY_TAGS',
      entryId: activeEntry.id,
      tags: { [field]: value },
    });
  };

  return (
    <div className="active-bar">
      {activeEntry && task ? (
        <>
          <div className="active-bar__indicator" style={{ backgroundColor: task.color }} />
          <div className="active-bar__info">
            <span className="active-bar__label">Active:</span>
            <span className="active-bar__task">{task.name}</span>
            <span className="active-bar__timer">{formatDuration(elapsed)}</span>
            {(activeEntry.projectId || activeEntry.valueCategory) && (
              <span className="active-bar__tags-preview">
                {activeEntry.projectId && <span className="active-bar__tag-badge">{activeEntry.projectId}</span>}
                {activeEntry.valueCategory && <span className="active-bar__tag-badge">{activeEntry.valueCategory}</span>}
              </span>
            )}
          </div>
          <button
            className="btn btn--tag-toggle"
            onClick={() => setTagsOpen(!tagsOpen)}
            title="Tag this session"
            aria-label={tagsOpen ? 'Hide tags' : 'Show tags'}
            aria-expanded={tagsOpen}
          >
            {tagsOpen ? '▾' : '▸'} Tags
          </button>
          <button
            className="btn btn--stop"
            onClick={() => dispatch({ type: 'STOP_TASK' })}
            title="Stop (Esc)"
            aria-label="Stop current task"
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

      {/* Expandable tags panel */}
      {tagsOpen && activeEntry && (
        <div className="active-bar__tags">
          <TagSelector
            category="project"
            value={activeEntry.projectId}
            onChange={v => handleTagChange('projectId', v)}
            compact
          />
          <TagSelector
            category="value_category"
            value={activeEntry.valueCategory}
            onChange={v => handleTagChange('valueCategory', v)}
            compact
          />
          <TagSelector
            category="work_style"
            value={activeEntry.workStyle}
            onChange={v => handleTagChange('workStyle', v)}
            compact
          />
        </div>
      )}
    </div>
  );
};
