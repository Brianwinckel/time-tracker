// ============================================================
// ProjectPicker — reusable project selection field
// ------------------------------------------------------------
// Used by FullscreenPanelScreen (and any future surface that
// assigns a Project to a Panel instance). Provides:
//   * a button-style trigger showing the current project + color
//   * a popover with: Recent row, search, full list, + New row
//   * inline create — no leaving the screen to add a project
//
// Calls `touchProject(id)` on selection so Recent stays accurate.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNav } from '../lib/previewNav';
import {
  colorOptionFor,
  PANEL_COLOR_OPTIONS,
} from '../lib/panelCatalog';
import {
  findProject,
  getRecentProjects,
  searchProjects,
  type Project,
} from '../lib/projects';

interface ProjectPickerProps {
  /** Currently selected project id, or undefined for "no project". */
  value: string | undefined;
  /** Called with the new project. Receives the resolved Project for
   *  convenience so callers can also snapshot the display name. */
  onChange: (project: Project) => void;
  /** Optional class override for the trigger button. */
  triggerClassName?: string;
  /** Visual size of the trigger — desktop uses 'md' (h-11), mobile 'sm' (h-10). */
  size?: 'sm' | 'md';
}

export const ProjectPicker: React.FC<ProjectPickerProps> = ({
  value,
  onChange,
  triggerClassName,
  size = 'md',
}) => {
  const { projects, createProject, touchProject } = useNav();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const popRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const selected = useMemo(() => findProject(projects, value), [projects, value]);
  const recent = useMemo(() => getRecentProjects(projects, 5), [projects]);
  const filtered = useMemo(() => searchProjects(projects, query), [projects, query]);

  // Close on outside click / escape.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
      setCreating(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (project: Project) => {
    touchProject(project.id);
    onChange(project);
    setOpen(false);
    setQuery('');
    setCreating(false);
  };

  const submitNew = () => {
    const name = newName.trim();
    if (!name) return;
    const project = createProject({ name, colorId: newColor });
    pick(project);
    setNewName('');
    setNewColor('blue');
  };

  const triggerHeight = size === 'sm' ? 'h-10' : 'h-11';

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={
          triggerClassName ??
          `w-full ${triggerHeight} px-3 pr-8 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 flex items-center gap-2 text-left`
        }
      >
        {selected ? (
          <>
            <span
              className={`w-2.5 h-2.5 rounded-full ${colorOptionFor(selected.colorId).barClass} shrink-0`}
              aria-hidden
            />
            <span className="truncate flex-1">{selected.name}</span>
          </>
        ) : (
          <span className="text-slate-400 truncate flex-1">Choose a project…</span>
        )}
        <svg
          className="w-4 h-4 text-slate-400 shrink-0 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute z-30 mt-2 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
        >
          {!creating ? (
            <>
              {/* Search */}
              <div className="px-3 py-2 border-b border-slate-100">
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search projects…"
                  className="w-full h-9 px-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Recent row */}
              {recent.length > 0 && !query && (
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Recent
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map(p => {
                      const color = colorOptionFor(p.colorId);
                      const active = p.id === value;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => pick(p)}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${color.barClass}`} aria-hidden />
                          <span className="truncate max-w-[8rem]">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* List */}
              <ul className="max-h-56 overflow-auto">
                {filtered.length === 0 ? (
                  <li className="px-3 py-4 text-center text-xs text-slate-400">
                    No projects match.
                  </li>
                ) : (
                  filtered.map(p => {
                    const color = colorOptionFor(p.colorId);
                    const active = p.id === value;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => pick(p)}
                          className={`w-full px-3 py-2 flex items-center gap-2 text-left text-sm ${
                            active ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${color.barClass} shrink-0`}
                            aria-hidden
                          />
                          <span className="truncate flex-1">{p.name}</span>
                          {active && (
                            <svg
                              className="w-4 h-4 text-blue-600 shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>

              {/* + New */}
              <div className="border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setCreating(true);
                    setNewName(query);
                  }}
                  className="w-full px-3 py-2.5 flex items-center gap-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New Project{query ? ` "${query}"` : ''}
                </button>
              </div>
            </>
          ) : (
            <div className="p-3 space-y-3">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitNew();
                }}
                placeholder="Project name"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5">
                {PANEL_COLOR_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setNewColor(opt.id)}
                    className={`w-7 h-7 rounded-lg ${opt.barClass} ring-offset-2 ring-offset-white ${
                      newColor === opt.id ? 'ring-2 ring-slate-900' : ''
                    }`}
                    aria-label={opt.label}
                  />
                ))}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setNewName('');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitNew}
                  disabled={!newName.trim()}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg disabled:opacity-40 hover:bg-slate-800"
                >
                  Create & Select
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
