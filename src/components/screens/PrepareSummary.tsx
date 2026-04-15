// ============================================================
// Prepare Summary screen — report preparation flow
// User lands here from "Generate Summary" on the Home screen.
// Lets the user configure sources, outcomes, audience, and style
// before generating the final report.
// ============================================================

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatDuration } from '../../utils/time';
import type { Task, TimeEntry } from '../../types';

// ---- Types ----

type ReportType = 'daily' | 'performance';
type Audience = 'manager' | 'internal' | 'client' | 'personal';
type SummaryStyle = 'concise' | 'standard' | 'detailed';
type PanelOutcome = 'completed' | 'in-progress' | 'follow-up' | 'abandoned';

interface FollowUpDetails {
  waitingOn: string;
  passedOffTo: string;
  nextStep: string;
}

interface PanelOutcomeState {
  outcome: PanelOutcome | null;
  followUp: FollowUpDetails;
  abandonedValuable: boolean | null;
}

interface TaskSummary {
  task: Task;
  totalMs: number;
  entryCount: number;
  entries: TimeEntry[];
}

// ---- Outcome chip config ----

const OUTCOME_OPTIONS: {
  value: PanelOutcome;
  label: string;
  bg: string;
  border: string;
  text: string;
}[] = [
  { value: 'completed',   label: 'Completed',        bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  { value: 'in-progress', label: 'In Progress',      bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700' },
  { value: 'follow-up',   label: 'Needs Follow-Up',  bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700' },
  { value: 'abandoned',   label: 'Abandoned',         bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700' },
];

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: 'manager',  label: 'Manager' },
  { value: 'internal', label: 'Internal' },
  { value: 'client',   label: 'Client' },
  { value: 'personal', label: 'Personal' },
];

const STYLE_OPTIONS: { value: SummaryStyle; label: string }[] = [
  { value: 'concise',  label: 'Concise' },
  { value: 'standard', label: 'Standard' },
  { value: 'detailed', label: 'Detailed' },
];

// ---- Component ----

export const PrepareSummary: React.FC = () => {
  const { state, dispatch } = useApp();
  const { user } = useAuth();

  // ---- Local state ----
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [sources, setSources] = useState({
    taskpanels: true,
    claude: false,
    browser: false,
  });
  const [panelOutcomes, setPanelOutcomes] = useState<Record<string, PanelOutcomeState>>({});
  const [audience, setAudience] = useState<Audience>('manager');
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>('standard');

  // ---- Compute task summaries from entries ----
  const taskSummaries = useMemo<TaskSummary[]>(() => {
    const grouped: Record<string, { totalMs: number; entries: TimeEntry[] }> = {};

    for (const entry of state.entries) {
      if (!grouped[entry.taskId]) {
        grouped[entry.taskId] = { totalMs: 0, entries: [] };
      }
      const duration = entry.duration ?? (Date.now() - new Date(entry.startTime).getTime());
      grouped[entry.taskId].totalMs += duration;
      grouped[entry.taskId].entries.push(entry);
    }

    return Object.entries(grouped)
      .map(([taskId, data]) => {
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return null;
        return {
          task,
          totalMs: data.totalMs,
          entryCount: data.entries.length,
          entries: data.entries,
        };
      })
      .filter((s): s is TaskSummary => s !== null)
      .sort((a, b) => b.totalMs - a.totalMs);
  }, [state.entries, state.tasks]);

  // ---- Compute total tracked time ----
  const totalTrackedMs = useMemo(() => {
    return state.entries.reduce((sum, entry) => {
      const duration = entry.duration ?? (Date.now() - new Date(entry.startTime).getTime());
      return sum + duration;
    }, 0);
  }, [state.entries]);

  // ---- Format the current date for display ----
  const displayDate = useMemo(() => {
    const d = new Date(state.currentDate + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [state.currentDate]);

  // ---- Helpers ----

  function toggleSource(key: keyof typeof sources) {
    setSources(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function getOutcomeState(taskId: string): PanelOutcomeState {
    return panelOutcomes[taskId] ?? {
      outcome: null,
      followUp: { waitingOn: '', passedOffTo: '', nextStep: '' },
      abandonedValuable: null,
    };
  }

  function setOutcome(taskId: string, outcome: PanelOutcome) {
    setPanelOutcomes(prev => ({
      ...prev,
      [taskId]: {
        ...getOutcomeState(taskId),
        outcome: prev[taskId]?.outcome === outcome ? null : outcome,
      },
    }));
  }

  function updateFollowUp(taskId: string, field: keyof FollowUpDetails, value: string) {
    setPanelOutcomes(prev => ({
      ...prev,
      [taskId]: {
        ...getOutcomeState(taskId),
        followUp: { ...getOutcomeState(taskId).followUp, [field]: value },
      },
    }));
  }

  function setAbandonedValuable(taskId: string, value: boolean) {
    setPanelOutcomes(prev => ({
      ...prev,
      [taskId]: {
        ...getOutcomeState(taskId),
        abandonedValuable: value,
      },
    }));
  }

  // ---- Render ----

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* ======== Header ======== */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'dashboard' })}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all duration-150"
            aria-label="Back to dashboard"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Prepare Summary</h1>
            <p className="text-sm text-slate-500 mt-0.5">{displayDate}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Tracked</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">{formatDuration(totalTrackedMs)}</p>
        </div>
      </div>

      {/* ======== Report Type Toggle ======== */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Report Type</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setReportType('daily')}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              reportType === 'daily'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Daily Summary
          </button>
          <button
            onClick={() => setReportType('performance')}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              reportType === 'performance'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Performance Review
          </button>
        </div>
      </section>

      {/* ======== Included Sources ======== */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Included Sources</h2>
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'taskpanels' as const, label: 'TaskPanels Activity', icon: '📋' },
            { key: 'claude' as const,     label: 'Claude Work',         icon: '🤖' },
            { key: 'browser' as const,    label: 'Browser AI Work',     icon: '🌐' },
          ]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => toggleSource(key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all duration-150 ${
                sources[key]
                  ? 'opacity-100 bg-slate-50 border-slate-300 text-slate-700 shadow-sm'
                  : 'opacity-45 bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ======== Panel Outcomes ======== */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Panel Outcomes</h2>
        {taskSummaries.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No panels with activity today.</p>
        ) : (
          <div className="space-y-4">
            {taskSummaries.map(({ task, totalMs, entryCount }) => {
              const outcomeState = getOutcomeState(task.id);
              return (
                <div key={task.id} className="rounded-xl border border-slate-200 p-4">
                  {/* Panel header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: task.color }}
                      />
                      <span className="text-sm font-semibold text-slate-800">{task.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-slate-600">{formatDuration(totalMs)}</span>
                      <span className="text-xs text-slate-400 ml-1.5">
                        ({entryCount} {entryCount === 1 ? 'session' : 'sessions'})
                      </span>
                    </div>
                  </div>

                  {/* Outcome chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {OUTCOME_OPTIONS.map(opt => {
                      const isSelected = outcomeState.outcome === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setOutcome(task.id, opt.value)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 ${
                            isSelected
                              ? `${opt.bg} ${opt.border} ${opt.text}`
                              : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Conditional: Follow-Up details */}
                  {outcomeState.outcome === 'follow-up' && (
                    <div className="mt-3 space-y-2 pl-1">
                      <input
                        type="text"
                        placeholder="Waiting on..."
                        value={outcomeState.followUp.waitingOn}
                        onChange={e => updateFollowUp(task.id, 'waitingOn', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-violet-200 bg-violet-50/50 text-sm text-slate-700 placeholder:text-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all duration-150"
                      />
                      <input
                        type="text"
                        placeholder="Passed off to..."
                        value={outcomeState.followUp.passedOffTo}
                        onChange={e => updateFollowUp(task.id, 'passedOffTo', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-violet-200 bg-violet-50/50 text-sm text-slate-700 placeholder:text-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all duration-150"
                      />
                      <input
                        type="text"
                        placeholder="Next step..."
                        value={outcomeState.followUp.nextStep}
                        onChange={e => updateFollowUp(task.id, 'nextStep', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-violet-200 bg-violet-50/50 text-sm text-slate-700 placeholder:text-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all duration-150"
                      />
                    </div>
                  )}

                  {/* Conditional: Abandoned — unrealized effort */}
                  {outcomeState.outcome === 'abandoned' && (
                    <div className="mt-3 pl-1">
                      <p className="text-xs font-medium text-red-600 mb-2">Was this still valuable work?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAbandonedValuable(task.id, true)}
                          className={`px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 ${
                            outcomeState.abandonedValuable === true
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setAbandonedValuable(task.id, false)}
                          className={`px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 ${
                            outcomeState.abandonedValuable === false
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ======== Audience / Target ======== */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Audience / Target</h2>
        <div className="flex flex-wrap gap-2">
          {AUDIENCE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setAudience(opt.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                audience === opt.value
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* ======== Summary Style ======== */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Summary Style</h2>
        <div className="flex flex-wrap gap-2">
          {STYLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSummaryStyle(opt.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                summaryStyle === opt.value
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* ======== Generate Report CTA ======== */}
      <button
        onClick={() => dispatch({ type: 'SET_VIEW', view: 'review' })}
        className="w-full py-3.5 rounded-2xl bg-slate-900 text-white text-base font-semibold shadow-lg hover:bg-slate-800 active:scale-[0.98] transition-all duration-150"
      >
        Generate Report
      </button>
    </div>
  );
};

export default PrepareSummary;
