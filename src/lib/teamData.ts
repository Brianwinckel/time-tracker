// ============================================================
// teamData — fetch helpers for Team screens.
//
// Reads live from Supabase (not through cloudState). Team data
// is authoritative on the server, low-frequency, and shared
// across members — caching it in localStorage would invite
// stale reads when an admin adds/removes a member from a
// different device.
// ============================================================

import { supabase } from './supabase';

export interface TeamRow {
  id: string;
  name: string;
  created_by: string | null;
  seats_purchased: number;
  default_department_id: string | null;
}

export interface DepartmentRow {
  id: string;
  team_id: string;
  name: string;
  is_default: boolean;
}

export interface MemberRow {
  id: string;
  email: string;
  name: string;
  team_role: 'owner' | 'admin' | 'member';
  department_id: string | null;
}

export interface LiveRun {
  run_id: string;
  user_id: string;
  user_name: string;
  panel_id: string;
  panel_name: string;
  started_at: string;
}

export async function fetchTeam(teamId: string): Promise<TeamRow | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, created_by, seats_purchased, default_department_id')
    .eq('id', teamId)
    .single();
  if (error) {
    console.error('[teamData] fetchTeam failed:', error.message);
    return null;
  }
  return data as TeamRow;
}

export async function fetchMembers(teamId: string): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, team_role, department_id')
    .eq('team_id', teamId)
    .order('team_role', { ascending: true }) // owner, admin, member — alpha happens to match
    .order('name', { ascending: true });
  if (error) {
    console.error('[teamData] fetchMembers failed:', error.message);
    return [];
  }
  return (data || []) as MemberRow[];
}

export async function fetchDepartments(teamId: string): Promise<DepartmentRow[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('id, team_id, name, is_default')
    .eq('team_id', teamId)
    .order('is_default', { ascending: false }) // default first
    .order('name', { ascending: true });
  if (error) {
    console.error('[teamData] fetchDepartments failed:', error.message);
    return [];
  }
  return (data || []) as DepartmentRow[];
}

/**
 * Currently-running timers across the team. A run is "live" when
 * ended_at is null. We join in profiles.name client-side via a
 * separate lookup since PostgREST joins against user_runs are
 * scoped by user_id (no team FK to filter on server-side).
 */
export async function fetchLiveActivity(teamId: string): Promise<LiveRun[]> {
  // Step 1: every user_id in the team
  const members = await fetchMembers(teamId);
  if (members.length === 0) return [];
  const memberIds = members.map(m => m.id);
  const nameById = new Map(members.map(m => [m.id, m.name || m.email]));

  // Step 2: live runs for those users
  const { data, error } = await supabase
    .from('user_runs')
    .select('id, user_id, panel_id, started_at')
    .in('user_id', memberIds)
    .is('ended_at', null)
    .order('started_at', { ascending: true });
  if (error) {
    console.error('[teamData] fetchLiveActivity failed:', error.message);
    return [];
  }
  const runs = data || [];
  if (runs.length === 0) return [];

  // Step 3: resolve panel names. The user_panels_select_team_admin
  // policy lets owners/admins read peer panel rows, so this query
  // works for whoever can see this feed. Panel display name lives
  // in user_panels.data (jsonb).
  const panelIds = Array.from(new Set(runs.map(r => r.panel_id)));
  const { data: panelRows } = await supabase
    .from('user_panels')
    .select('id, data')
    .in('id', panelIds);
  const nameByPanel = new Map<string, string>();
  for (const row of (panelRows || [])) {
    const data = row.data as { name?: string } | null;
    if (data?.name) nameByPanel.set(row.id, data.name);
  }

  return runs.map(r => ({
    run_id: r.id,
    user_id: r.user_id,
    user_name: nameById.get(r.user_id) || 'Unknown',
    panel_id: r.panel_id,
    panel_name: nameByPanel.get(r.panel_id) || 'Working…',
    started_at: r.started_at,
  }));
}
