// ============================================================
// Clients — parent-of-project entity for attribution + reporting.
//
// Scope matches projects:
//   - Solo users: user_id scoped (private).
//   - Team members: team_id scoped (shared across the team).
//
// Mirrors the project lib pattern: local-first via localStorage,
// cloud sync through cloudRelational. Reports by client are built
// on top of this data layer in a later phase.
// ============================================================

import { diffPushClients } from './cloudRelational';

export interface Client {
  id: string;
  name: string;
  archived: boolean;
  createdAt: number;
  /** null = personal (user-scoped); a uuid = team-scoped (shared
   *  with every team member). Mirrors the scope split used by
   *  billing_customers and other per-user-or-per-team entities. */
  teamId: string | null;
  /** The auth.users.id of whoever created the client. Populated
   *  on cloud hydrate; used client-side so diff pushes skip rows
   *  the current user didn't create (team members shouldn't try to
   *  re-upload the owner's rows). */
  ownerUserId?: string;
}

function newClientId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `cli_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeClient(input: {
  id?: string;
  name: string;
  teamId?: string | null;
}): Client {
  return {
    id: input.id ?? newClientId(),
    name: input.name.trim() || 'Untitled Client',
    archived: false,
    createdAt: Date.now(),
    teamId: input.teamId ?? null,
  };
}

const CLIENTS_STORAGE_KEY = 'taskpanels.clients.v1';

export function loadClients(): Client[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Client[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(c =>
      c && typeof c.id === 'string' && typeof c.name === 'string',
    );
  } catch {
    return [];
  }
}

export function saveClients(clients: Client[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
  } catch {
    /* ignore */
  }
  diffPushClients(clients);
}

export function activeClients(clients: Client[]): Client[] {
  return clients.filter(c => !c.archived);
}

export function findClient(clients: Client[], id: string | null | undefined): Client | undefined {
  if (!id) return undefined;
  return clients.find(c => c.id === id);
}
