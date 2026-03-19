// ============================================================
// Manager Dashboard — live team view + daily summary
// Shows all team members, their active tasks, and time breakdowns
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth, type Profile } from '../context/AuthContext';
import { useRealtimeEntries } from '../hooks/useRealtimeEntries';
import { EmployeeCard } from './EmployeeCard';
import { getToday, formatDateLong, formatTime, formatDuration, formatDurationShort } from '../utils/time';
import { getTaskTotals, getGrandTotal, getGapTime } from '../utils/summary';
import { useApp } from '../context/AppContext';

export const ManagerDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { state } = useApp();
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const tf = state.settings.timeFormat;

  // Fetch team members
  useEffect(() => {
    if (!profile) return;

    const fetchMembers = async () => {
      let query = supabase.from('profiles').select('*');

      // Managers see their own team; admins see everyone
      if (profile.role === 'manager' && profile.team_id) {
        query = query.eq('team_id', profile.team_id);
      }

      const { data, error } = await query.order('name');
      if (error) {
        console.error('Failed to fetch team members:', error.message);
      } else {
        setTeamMembers((data ?? []) as Profile[]);
      }
      setLoadingMembers(false);
    };

    fetchMembers();
  }, [profile]);

  // Get user IDs for the realtime hook
  const teamUserIds = useMemo(
    () => teamMembers.map(m => m.id),
    [teamMembers]
  );

  // Realtime entries for the selected date
  const { entries, loading: loadingEntries } = useRealtimeEntries(selectedDate, teamUserIds);

  // Group entries by user
  const entriesByUser = useMemo(() => {
    const grouped: Record<string, typeof entries> = {};
    for (const entry of entries) {
      if (!grouped[entry.userId]) grouped[entry.userId] = [];
      grouped[entry.userId].push(entry);
    }
    return grouped;
  }, [entries]);

  // Selected employee's detailed view
  const selectedMember = teamMembers.find(m => m.id === selectedEmployee);
  const selectedEntries = selectedEmployee ? (entriesByUser[selectedEmployee] ?? []) : [];
  const selectedCompleted = selectedEntries.filter(e => e.endTime);
  const selectedTotals = getTaskTotals(selectedCompleted, state.tasks);
  const selectedGrand = getGrandTotal(selectedCompleted);
  const selectedGap = getGapTime(selectedCompleted);

  // Summary stats
  const activeCount = teamMembers.filter(m =>
    (entriesByUser[m.id] ?? []).some(e => !e.endTime)
  ).length;
  const totalTrackedMs = entries
    .filter(e => e.endTime)
    .reduce((sum, e) => sum + (e.duration ?? 0), 0);

  if (loadingMembers) {
    return <div className="loading-screen">Loading team...</div>;
  }

  return (
    <div className="manager">
      {/* Header stats */}
      <div className="manager__header">
        <h2>Team Dashboard</h2>
        <div className="manager__stats">
          <div className="manager__stat">
            <span className="manager__stat-value">{teamMembers.length}</span>
            <span className="manager__stat-label">Members</span>
          </div>
          <div className="manager__stat">
            <span className="manager__stat-value manager__stat-value--active">{activeCount}</span>
            <span className="manager__stat-label">Active Now</span>
          </div>
          <div className="manager__stat">
            <span className="manager__stat-value">{formatDurationShort(totalTrackedMs)}</span>
            <span className="manager__stat-label">Team Total</span>
          </div>
        </div>
      </div>

      {/* Date picker */}
      <div className="manager__date-picker">
        <label className="field">
          <span>Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setSelectedEmployee(null); }}
            max={getToday()}
          />
        </label>
        <span className="manager__date-label">{formatDateLong(selectedDate)}</span>
      </div>

      {/* Employee grid */}
      {!selectedEmployee ? (
        <div className="manager__grid">
          {loadingEntries && <p className="manager__loading">Loading entries...</p>}
          {teamMembers.map(member => (
            <EmployeeCard
              key={member.id}
              name={member.name}
              email={member.email}
              entries={entriesByUser[member.id] ?? []}
              onClick={() => setSelectedEmployee(member.id)}
            />
          ))}
          {teamMembers.length === 0 && (
            <p className="manager__empty">No team members found.</p>
          )}
        </div>
      ) : (
        /* Employee detail view */
        <div className="manager__detail">
          <button
            className="btn btn--secondary"
            onClick={() => setSelectedEmployee(null)}
          >
            &larr; Back to team
          </button>

          <h3 className="manager__detail-name">
            {selectedMember?.name || selectedMember?.email}
          </h3>

          {/* Task totals */}
          {selectedTotals.length > 0 ? (
            <div className="manager__detail-totals">
              <h4>Time by Task</h4>
              <div className="summary__bars">
                {selectedTotals.map(t => {
                  const pct = selectedGrand > 0 ? (t.totalMs / selectedGrand) * 100 : 0;
                  return (
                    <div key={t.taskId} className="summary__bar-row">
                      <span className="summary__bar-label">{t.taskName}</span>
                      <div className="summary__bar-track">
                        <div
                          className="summary__bar-fill"
                          style={{ width: `${pct}%`, backgroundColor: t.color }}
                        />
                      </div>
                      <span className="summary__bar-value">{formatDurationShort(t.totalMs)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="summary__grand-total">
                <span>Total: <strong>{formatDurationShort(selectedGrand)}</strong></span>
                {selectedGap > 0 && (
                  <span className="summary__gap">Gaps: {formatDurationShort(selectedGap)}</span>
                )}
              </div>
            </div>
          ) : (
            <p className="manager__empty">No completed sessions for this date.</p>
          )}

          {/* Session log */}
          {selectedCompleted.length > 0 && (
            <div className="manager__detail-log">
              <h4>Session Log</h4>
              <table className="summary__table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Task</th>
                    <th>Duration</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCompleted
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                    .map(entry => (
                      <tr key={entry.id}>
                        <td>{formatTime(entry.startTime, tf)} – {formatTime(entry.endTime!, tf)}</td>
                        <td>{entry.taskName}</td>
                        <td>{formatDuration(entry.duration ?? 0)}</td>
                        <td className="summary__note-cell">{entry.note || '—'}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
