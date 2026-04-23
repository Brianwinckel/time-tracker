// ============================================================
// TeamMembersScreen — roster + invite flow for owners/admins.
//
// Admins can:
//   - Invite by email (picks department + role); calls the
//     invite-team-member edge function which inserts the invite
//     row and triggers Supabase's admin invite email (via Brevo).
//   - Revoke pending invites.
//   - Remove existing non-owner members.
// Seat-cap is shown inline; invite button disables at capacity.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNav } from '../../lib/previewNav';
import {
  fetchMembers, fetchDepartments, fetchTeam,
  type MemberRow, type DepartmentRow, type TeamRow,
} from '../../lib/teamData';

const BackArrow = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 19l-7-7 7-7" />
  </svg>
);

interface InviteRow {
  id: string;
  email: string;
  role: 'admin' | 'member';
  department_id: string | null;
  created_at: string;
}

export const TeamMembersScreen: React.FC = () => {
  const { profile } = useAuth();
  const { navigate } = useNav();
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [deptId, setDeptId] = useState<string>('');
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [inviteOk, setInviteOk] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const teamId = profile?.team_id;
  const isAdmin = profile?.team_role === 'owner' || profile?.team_role === 'admin';

  const loadAll = useCallback(async () => {
    if (!teamId) return;
    const [t, m, d, invRes] = await Promise.all([
      fetchTeam(teamId),
      fetchMembers(teamId),
      fetchDepartments(teamId),
      supabase.from('team_invites')
        .select('id, email, role, department_id, created_at')
        .eq('team_id', teamId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false }),
    ]);
    setTeam(t);
    setMembers(m);
    setDepartments(d);
    setInvites((invRes.data || []) as InviteRow[]);
    if (!deptId && t?.default_department_id) setDeptId(t.default_department_id);
    setLoading(false);
  }, [teamId, deptId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const seatsPurchased = team?.seats_purchased ?? 0;
  const seatsUsed = members.length + invites.length;
  const seatsRemaining = Math.max(0, seatsPurchased - seatsUsed);
  const atCapacity = seatsRemaining <= 0;

  const deptName = (id: string | null) =>
    id ? departments.find(d => d.id === id)?.name || 'Unknown' : 'Unassigned';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setInviteErr(null);
    setInviteOk(null);
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-team-member', {
        body: {
          email: email.trim(),
          role,
          departmentId: deptId || null,
          appUrl: window.location.origin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInviteOk(`Invite sent to ${email.trim()}.`);
      setEmail('');
      await loadAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send invite';
      setInviteErr(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!confirm('Revoke this invite?')) return;
    const { error } = await supabase.from('team_invites').delete().eq('id', inviteId);
    if (error) { alert(`Revoke failed: ${error.message}`); return; }
    await loadAll();
  };

  const [resendingId, setResendingId] = useState<string | null>(null);
  const handleResend = async (inviteId: string) => {
    setResendingId(inviteId);
    try {
      const { data, error } = await supabase.functions.invoke('resend-team-invite', {
        body: { inviteId, appUrl: window.location.origin },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    } catch (err) {
      alert(`Resend failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResendingId(null);
    }
  };

  const handleRemove = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from the team?`)) return;
    const { error } = await supabase.rpc('remove_team_member', { target_user_id: memberId });
    if (error) { alert(`Remove failed: ${error.message}`); return; }
    await loadAll();
  };

  // Inline role change. Optimistic — we reload after so server is truth.
  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'member') => {
    const { error } = await supabase.rpc('update_team_member_role', {
      target_user_id: memberId, new_role: newRole,
    });
    if (error) { alert(`Role change failed: ${error.message}`); return; }
    await loadAll();
  };

  const handleDepartmentChange = async (memberId: string, newDeptId: string) => {
    const { error } = await supabase.rpc('update_team_member_department', {
      target_user_id: memberId,
      new_department_id: newDeptId || null,
    });
    if (error) { alert(`Department change failed: ${error.message}`); return; }
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
            <h1 className="text-lg font-bold text-slate-900 truncate">Members</h1>
          </div>
          <span className="text-xs font-semibold text-slate-500 shrink-0">
            {seatsUsed} / {seatsPurchased}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-5">
        {/* Invite form (owners/admins only) */}
        {isAdmin && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Invite someone</h3>
            {atCapacity ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                At capacity ({seatsUsed}/{seatsPurchased}). Add seats from Billing to invite more.
              </p>
            ) : (
              <form onSubmit={handleInvite} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  required
                  disabled={submitting}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                />
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-medium text-slate-600">
                    Department
                    <select
                      value={deptId}
                      onChange={(e) => setDeptId(e.target.value)}
                      disabled={submitting}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white disabled:opacity-60"
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name}{d.is_default ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Role
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
                      disabled={submitting}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white disabled:opacity-60"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                </div>
                {inviteErr && <p className="text-sm text-rose-600">{inviteErr}</p>}
                {inviteOk && <p className="text-sm text-emerald-600">{inviteOk}</p>}
                <button
                  type="submit"
                  disabled={submitting || !email.trim()}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Sending…' : 'Send invite'}
                </button>
                <p className="text-xs text-slate-400">
                  {seatsRemaining} {seatsRemaining === 1 ? 'seat' : 'seats'} remaining.
                </p>
              </form>
            )}
          </section>
        )}

        {/* Pending invites */}
        {invites.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
              Pending invites
            </h3>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <ul className="divide-y divide-slate-100">
                {invites.map(inv => (
                  <li key={inv.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{inv.email}</p>
                      <p className="text-xs text-slate-500">
                        {deptName(inv.department_id)} · {inv.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                        Pending
                      </span>
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleResend(inv.id)}
                            disabled={resendingId === inv.id}
                            className="text-xs text-slate-500 hover:text-slate-900 disabled:opacity-60"
                          >
                            {resendingId === inv.id ? 'Sending…' : 'Resend'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(inv.id)}
                            className="text-xs text-slate-500 hover:text-rose-600"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Members */}
        <section>
          <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Members
          </h3>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {loading ? (
              <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
            ) : members.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">No members yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {members.map(m => {
                  const editable = isAdmin && m.team_role !== 'owner' && m.id !== profile?.id;
                  return (
                    <li key={m.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {m.name || m.email}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{m.email}</p>
                          {editable ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <select
                                value={m.department_id ?? ''}
                                onChange={e => handleDepartmentChange(m.id, e.target.value)}
                                className="text-xs rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
                              >
                                <option value="">Unassigned</option>
                                {departments.map(d => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                              <select
                                value={m.team_role}
                                onChange={e => handleRoleChange(m.id, e.target.value as 'admin' | 'member')}
                                className="text-xs rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
                              >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-slate-500">
                              {deptName(m.department_id)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!editable && (
                            <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
                              {m.team_role}
                            </span>
                          )}
                          {editable && (
                            <button
                              type="button"
                              onClick={() => handleRemove(m.id, m.name || m.email)}
                              className="text-xs text-slate-500 hover:text-rose-600"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
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
