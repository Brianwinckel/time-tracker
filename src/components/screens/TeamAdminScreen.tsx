// ============================================================
// TeamAdminScreen — landing view for owners and admins.
//
// Shows the team header (name + seat usage) and a live activity
// feed of everyone currently tracking time. Sub-screens for
// Members, Departments, and Billing are reached via the nav
// cards below the feed — following the same sub-screen pattern
// Settings uses (settings-*, team-*).
// ============================================================

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNav } from '../../lib/previewNav';
import { supabase } from '../../lib/supabase';
import {
  fetchTeam, fetchMembers, fetchLiveActivity, fetchDepartments,
  type TeamRow, type MemberRow, type LiveRun, type DepartmentRow,
} from '../../lib/teamData';

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const LayersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

const CreditCardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);

const ChevronRight = () => (
  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

function elapsed(startedAt: string, now: number): string {
  const ms = now - new Date(startedAt).getTime();
  if (ms < 0) return '0m';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

export const TeamAdminScreen: React.FC = () => {
  const { profile } = useAuth();
  const { navigate } = useNav();
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [live, setLive] = useState<LiveRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const teamId = profile?.team_id;

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;

    const load = async () => {
      const [t, m, d, l] = await Promise.all([
        fetchTeam(teamId),
        fetchMembers(teamId),
        fetchDepartments(teamId),
        fetchLiveActivity(teamId),
      ]);
      if (cancelled) return;
      setTeam(t);
      setMembers(m);
      setDepartments(d);
      setLive(l);
      setLoading(false);
    };
    load();

    // Refresh live activity every 30s so the "who's tracking now"
    // feed stays fresh without being chatty.
    const refresh = window.setInterval(async () => {
      const l = await fetchLiveActivity(teamId);
      if (!cancelled) setLive(l);
    }, 30_000);

    return () => { cancelled = true; window.clearInterval(refresh); };
  }, [teamId]);

  // Tick elapsed display every second
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const handleOpenPortal = async () => {
    setPortalError(null);
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-portal', {
        body: { appUrl: window.location.origin },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('No portal URL returned');
      const url = new URL(data.url);
      if (!url.hostname.endsWith('stripe.com')) throw new Error('Invalid portal URL');
      window.location.href = data.url;
    } catch (err) {
      console.error('Portal error:', err);
      setPortalError(err instanceof Error ? err.message : 'Failed to open billing portal');
      setPortalLoading(false);
    }
  };

  if (!teamId) return null;

  const seatsUsed = members.length;
  const seatsTotal = team?.seats_purchased ?? 0;

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
        {/* Seat usage banner */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Seats</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">
              {seatsUsed} <span className="text-slate-400 font-medium">/ {seatsTotal} used</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {seatsUsed >= seatsTotal && seatsTotal > 0 && (
              <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                At capacity
              </span>
            )}
            <button
              type="button"
              onClick={handleOpenPortal}
              disabled={portalLoading}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 disabled:opacity-60"
            >
              {portalLoading ? 'Opening…' : 'Manage billing'}
            </button>
          </div>
        </section>
        {portalError && <p className="text-sm text-rose-600 px-1">{portalError}</p>}

        {/* Live activity */}
        <section>
          <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Tracking now
          </h3>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {loading ? (
              <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
            ) : live.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">
                No one is tracking right now.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {live.map(run => (
                  <li key={run.run_id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{run.user_name}</p>
                      <p className="text-xs text-slate-500 truncate">{run.panel_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm font-mono tabular-nums text-slate-700">
                        {elapsed(run.started_at, now)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Sub-screen nav */}
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => navigate('team-members')}
            className="w-full bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 hover:border-slate-300 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <UsersIcon />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">Members</p>
              <p className="text-xs text-slate-500">
                {seatsUsed} of {seatsTotal} · invite, assign, remove
              </p>
            </div>
            <ChevronRight />
          </button>

          <button
            type="button"
            onClick={() => navigate('team-departments')}
            className="w-full bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 hover:border-slate-300 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <LayersIcon />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">Departments</p>
              <p className="text-xs text-slate-500">
                {departments.length} {departments.length === 1 ? 'department' : 'departments'} · shared panels &amp; projects
              </p>
            </div>
            <ChevronRight />
          </button>

          <button
            type="button"
            onClick={handleOpenPortal}
            disabled={portalLoading}
            className="w-full bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 hover:border-slate-300 transition-colors text-left disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
              <CreditCardIcon />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">Billing</p>
              <p className="text-xs text-slate-500">Stripe portal · invoices, cancel, change seats</p>
            </div>
            <ChevronRight />
          </button>
        </section>
      </main>
    </div>
  );
};
