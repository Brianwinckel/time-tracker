// ============================================================
// TeamMemberScreen — read-only team view for non-admin members.
//
// Per product spec: members see only the roster of their own
// department. No live activity, no billing, no management.
// Their personal-work stats stay private from peers.
// ============================================================

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchTeam, fetchMembers, fetchDepartments,
  type TeamRow, type MemberRow, type DepartmentRow,
} from '../../lib/teamData';

export const TeamMemberScreen: React.FC = () => {
  const { profile } = useAuth();
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [dept, setDept] = useState<DepartmentRow | null>(null);
  const [deptMembers, setDeptMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const teamId = profile?.team_id;
  const myDeptId = profile?.department_id;

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;

    const load = async () => {
      const [t, members, depts] = await Promise.all([
        fetchTeam(teamId),
        fetchMembers(teamId),
        fetchDepartments(teamId),
      ]);
      if (cancelled) return;
      setTeam(t);
      const myDept = depts.find(d => d.id === myDeptId) || null;
      setDept(myDept);
      setDeptMembers(myDeptId ? members.filter(m => m.department_id === myDeptId) : []);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [teamId, myDeptId]);

  if (!teamId) return null;

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Team</p>
          <h1 className="text-lg font-bold text-slate-900 truncate">
            {team?.name || (loading ? 'Loading…' : 'Your team')}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-5">
        {/* Your department */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Your department</p>
          <p className="text-lg font-bold text-slate-900 mt-0.5">
            {dept?.name || (loading ? '…' : 'Unassigned')}
          </p>
          {!dept && !loading && (
            <p className="mt-2 text-xs text-slate-500">
              Ask a team admin to add you to a department.
            </p>
          )}
        </section>

        {/* Department roster */}
        {dept && (
          <section>
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
              Department members
            </h3>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {loading ? (
                <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
              ) : deptMembers.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400">
                  You're the only one in {dept.name} right now.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {deptMembers.map(m => (
                    <li key={m.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {m.name || m.email}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{m.email}</p>
                      </div>
                      {m.team_role !== 'member' && (
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize shrink-0">
                          {m.team_role}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        <section className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <p className="text-sm text-slate-700 leading-relaxed">
            <span className="font-semibold">Your personal panels, projects, and summaries are private.</span>{' '}
            Only you and your team admin can see what you're tracking.
          </p>
        </section>
      </main>
    </div>
  );
};
