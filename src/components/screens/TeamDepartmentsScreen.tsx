// ============================================================
// TeamDepartmentsScreen — CRUD for team departments (admin only).
//
// The default "General" department is created automatically with
// every team and cannot be deleted. Deleting a non-default dept
// moves its members + pending invites to the default first via
// the delete_department RPC — atomic, no orphaned references.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNav } from '../../lib/previewNav';
import {
  fetchDepartments, fetchMembers,
  type DepartmentRow, type MemberRow,
} from '../../lib/teamData';

const BackArrow = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 19l-7-7 7-7" />
  </svg>
);

export const TeamDepartmentsScreen: React.FC = () => {
  const { profile } = useAuth();
  const { navigate } = useNav();
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [newName, setNewName] = useState('');
  const [addErr, setAddErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editErr, setEditErr] = useState<string | null>(null);

  const teamId = profile?.team_id;
  const isAdmin = profile?.team_role === 'owner' || profile?.team_role === 'admin';

  const loadAll = useCallback(async () => {
    if (!teamId) return;
    const [d, m] = await Promise.all([fetchDepartments(teamId), fetchMembers(teamId)]);
    setDepartments(d);
    setMembers(m);
    setLoading(false);
  }, [teamId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const memberCount = (deptId: string) =>
    members.filter(m => m.department_id === deptId).length;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || adding || !teamId) return;
    setAddErr(null);
    setAdding(true);
    const { error } = await supabase
      .from('departments')
      .insert({ team_id: teamId, name, is_default: false });
    setAdding(false);
    if (error) {
      setAddErr(
        error.code === '23505'
          ? 'A department with that name already exists.'
          : error.message,
      );
      return;
    }
    setNewName('');
    await loadAll();
  };

  const startRename = (d: DepartmentRow) => {
    setEditingId(d.id);
    setEditName(d.name);
    setEditErr(null);
  };

  const handleRename = async (id: string) => {
    const name = editName.trim();
    if (!name) { setEditErr('Name required'); return; }
    const { error } = await supabase
      .from('departments')
      .update({ name })
      .eq('id', id);
    if (error) {
      setEditErr(
        error.code === '23505'
          ? 'A department with that name already exists.'
          : error.message,
      );
      return;
    }
    setEditingId(null);
    setEditName('');
    await loadAll();
  };

  const handleDelete = async (d: DepartmentRow) => {
    const n = memberCount(d.id);
    const msg = n === 0
      ? `Delete ${d.name}?`
      : `Delete ${d.name}? ${n} ${n === 1 ? 'member' : 'members'} will be moved to the default department.`;
    if (!confirm(msg)) return;
    const { error } = await supabase.rpc('delete_department', { target_id: d.id });
    if (error) {
      alert(`Delete failed: ${error.message}`);
      return;
    }
    await loadAll();
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('team')}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300"
            aria-label="Back"
          >
            <BackArrow />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Team</p>
            <h1 className="text-lg font-bold text-slate-900 truncate">Departments</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-5">
        {isAdmin && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Add a department</h3>
            <form onSubmit={handleAdd} className="flex items-stretch gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Engineering"
                maxLength={60}
                disabled={adding}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={adding || !newName.trim()}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adding ? 'Adding…' : 'Add'}
              </button>
            </form>
            {addErr && <p className="mt-2 text-sm text-rose-600">{addErr}</p>}
          </section>
        )}

        <section>
          <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Departments
          </h3>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {loading ? (
              <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
            ) : departments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">No departments yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {departments.map(d => {
                  const count = memberCount(d.id);
                  const isEditing = editingId === d.id;
                  return (
                    <li key={d.id} className="px-5 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="flex items-stretch gap-2">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                autoFocus
                                maxLength={60}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRename(d.id);
                                  if (e.key === 'Escape') { setEditingId(null); setEditErr(null); }
                                }}
                                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                              />
                              <button
                                type="button"
                                onClick={() => handleRename(d.id)}
                                className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEditingId(null); setEditErr(null); }}
                                className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                {d.name}
                                {d.is_default && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">
                                    Default
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500">
                                {count} {count === 1 ? 'member' : 'members'}
                              </p>
                            </>
                          )}
                        </div>
                        {isAdmin && !isEditing && (
                          <div className="flex items-center gap-3 shrink-0">
                            <button
                              type="button"
                              onClick={() => startRename(d)}
                              className="text-xs text-slate-500 hover:text-slate-900"
                            >
                              Rename
                            </button>
                            {!d.is_default && (
                              <button
                                type="button"
                                onClick={() => handleDelete(d)}
                                className="text-xs text-slate-500 hover:text-rose-600"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {isEditing && editErr && (
                        <p className="mt-2 text-sm text-rose-600">{editErr}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
