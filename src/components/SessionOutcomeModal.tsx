// ============================================================
// Session outcome modal — shown when ending a session
// Captures: completed?, status, output type, notes, blockers
// Always skippable — user can dismiss and tags default to In Progress
// ============================================================

import React, { useState } from 'react';
import type { TimeEntry } from '../types';
import { useApp } from '../context/AppContext';
import { TagSelector } from './TagSelector';
import { formatDurationShort } from '../utils/time';

interface Props {
  entry: TimeEntry;
  onClose: () => void;
}

export const SessionOutcomeModal: React.FC<Props> = ({ entry, onClose }) => {
  const { dispatch } = useApp();

  const [isCompleted, setIsCompleted] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<string>(entry.sessionStatus || 'In Progress');
  const [outputType, setOutputType] = useState<string | null>(entry.outputType);
  const [completionNote, setCompletionNote] = useState(entry.completionNote || '');
  const [nextSteps, setNextSteps] = useState(entry.nextSteps || '');
  const [blockedBy, setBlockedBy] = useState(entry.blockedBy || '');
  const [carryForward, setCarryForward] = useState(entry.carryForward || false);

  const handleSave = () => {
    dispatch({
      type: 'SET_ENTRY_TAGS',
      entryId: entry.id,
      tags: {
        isCompleted,
        sessionStatus: isCompleted ? 'Completed' : sessionStatus,
        outputType: isCompleted ? outputType : null,
        completionNote: isCompleted ? completionNote : '',
        nextSteps: !isCompleted ? nextSteps : '',
        blockedBy: !isCompleted ? blockedBy : '',
        carryForward: !isCompleted ? carryForward : false,
      },
    });
    onClose();
  };

  const handleSkip = () => {
    // Leave as default (In Progress, not completed)
    onClose();
  };

  const durationText = entry.duration ? formatDurationShort(entry.duration) : '';

  return (
    <div className="modal-overlay" onClick={handleSkip}>
      <div className="modal session-outcome" onClick={e => e.stopPropagation()}>
        <div className="session-outcome__header">
          <h3>Session Ended</h3>
          <span className="session-outcome__meta">
            {entry.taskName} {durationText && `\u2014 ${durationText}`}
          </span>
        </div>

        <div className="session-outcome__body">
          {/* Completed toggle */}
          <label className="field field--checkbox session-outcome__completed">
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={e => setIsCompleted(e.target.checked)}
            />
            <span>Completed</span>
          </label>

          {isCompleted ? (
            <>
              <TagSelector
                category="output_type"
                value={outputType}
                onChange={setOutputType}
                label="Output Type"
              />
              <label className="field">
                <span>What was completed?</span>
                <input
                  type="text"
                  value={completionNote}
                  onChange={e => setCompletionNote(e.target.value)}
                  placeholder="e.g. Finished draft landing page copy"
                  maxLength={200}
                />
              </label>
            </>
          ) : (
            <>
              <TagSelector
                category="session_status"
                value={sessionStatus}
                onChange={v => setSessionStatus(v ?? 'In Progress')}
                label="Status"
                allowClear={false}
              />
              <label className="field">
                <span>What is needed next?</span>
                <input
                  type="text"
                  value={nextSteps}
                  onChange={e => setNextSteps(e.target.value)}
                  placeholder="e.g. Needs design signoff before export"
                  maxLength={200}
                />
              </label>
              <label className="field">
                <span>Blocked by / waiting on</span>
                <input
                  type="text"
                  value={blockedBy}
                  onChange={e => setBlockedBy(e.target.value)}
                  placeholder="e.g. Creative director feedback"
                  maxLength={200}
                />
              </label>
              <label className="field field--checkbox">
                <input
                  type="checkbox"
                  checked={carryForward}
                  onChange={e => setCarryForward(e.target.checked)}
                />
                <span>Carry forward to tomorrow</span>
              </label>
            </>
          )}
        </div>

        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={handleSkip}>
            Skip
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
