// ============================================================
// Onboarding — role-based starter packs + persistence
// ------------------------------------------------------------
// Deterministic first pass: each WorkRole maps to a curated set
// of starter panel types. AI-assisted recommendations can later
// replace or augment the static packs without touching the UI.
// ============================================================

import { makePanel, type MockPanel } from './panelCatalog';

// ---- Work Roles ----

export interface WorkRole {
  id: string;
  label: string;
  description: string;
  /** Icon hint — the OnboardingScreen renders the actual SVG. */
  icon: string;
}

export const WORK_ROLES: WorkRole[] = [
  { id: 'marketing',    label: 'Marketing / Content',       description: 'Campaigns, writing, social, SEO',   icon: 'megaphone' },
  { id: 'product',      label: 'Product / Strategy',        description: 'Roadmaps, discovery, planning',     icon: 'lightbulb' },
  { id: 'design',       label: 'Design / Creative',         description: 'UI/UX, branding, assets',           icon: 'palette' },
  { id: 'engineering',  label: 'Engineering / Technical',    description: 'Code, architecture, debugging',     icon: 'code' },
  { id: 'operations',   label: 'Operations / Admin',        description: 'Process, coordination, tracking',   icon: 'cog' },
  { id: 'client',       label: 'Client / Consulting',       description: 'Delivery, reviews, presentations',  icon: 'briefcase' },
  { id: 'general',      label: 'General Knowledge Work',    description: 'Research, writing, meetings',        icon: 'squares' },
];

// ---- Starter Panel Packs ----

export interface StarterPanel {
  name: string;
  colorId: string;
}

/**
 * Role → recommended starter panels. These are intentionally small
 * sets (5–7 panels) so the user isn't overwhelmed.
 *
 * Future: an AI layer could replace this static map with personalized
 * recommendations based on the user's org, title, or short text input.
 */
const STARTER_PACKS: Record<string, StarterPanel[]> = {
  marketing: [
    { name: 'Content strategy & planning',   colorId: 'purple' },
    { name: 'Short-form video',              colorId: 'rose' },
    { name: 'Long-form video/podcast',       colorId: 'orange' },
    { name: 'AI content workflows',          colorId: 'teal' },
    { name: 'SEO & GEO',                    colorId: 'blue' },
    { name: 'Written content',               colorId: 'blue' },
    { name: 'Social & community',            colorId: 'rose' },
    { name: 'Email & lifecycle',             colorId: 'orange' },
    { name: 'Brand & design',               colorId: 'purple' },
    { name: 'Analytics & reporting',         colorId: 'teal' },
    { name: 'Paid media',                   colorId: 'amber' },
    { name: 'Influencer partnerships',       colorId: 'rose' },
    { name: 'Repurposing & distribution',    colorId: 'emerald' },
    { name: 'Cross-functional collab',       colorId: 'blue' },
    { name: 'Experimentation',              colorId: 'teal' },
    { name: 'Lunch & breaks',              colorId: 'emerald' },
    { name: 'Meetings & standups',          colorId: 'amber' },
    { name: '1:1s',                        colorId: 'amber' },
    { name: 'Email & Slack triage',         colorId: 'slate' },
    { name: 'Calendar mgmt',               colorId: 'slate' },
    { name: 'Expenses',                    colorId: 'slate' },
    { name: 'Timesheets',                  colorId: 'slate' },
    { name: 'HR tasks',                    colorId: 'slate' },
    { name: 'All-hands',                   colorId: 'amber' },
    { name: 'Onboarding & training',        colorId: 'emerald' },
    { name: 'IT tickets',                  colorId: 'slate' },
    { name: 'Security & passwords',         colorId: 'slate' },
    { name: 'File & asset mgmt',            colorId: 'slate' },
    { name: 'Informal chats',              colorId: 'amber' },
    { name: 'Context switching',            colorId: 'rose' },
  ],
  product: [
    { name: 'Strategy',       colorId: 'purple' },
    { name: 'Planning',       colorId: 'blue' },
    { name: 'Research',       colorId: 'teal' },
    { name: 'Review',         colorId: 'emerald' },
    { name: 'Meetings',       colorId: 'amber' },
    { name: 'Writing',        colorId: 'orange' },
  ],
  design: [
    { name: 'Design',         colorId: 'blue' },
    { name: 'Revisions',      colorId: 'orange' },
    { name: 'Research',       colorId: 'teal' },
    { name: 'Review',         colorId: 'emerald' },
    { name: 'Meetings',       colorId: 'amber' },
    { name: 'Admin',          colorId: 'slate' },
  ],
  engineering: [
    // 🔴 Critical / incident work
    { name: 'Incident response & troubleshooting', colorId: 'rose' },
    { name: 'Ticket queue management',             colorId: 'rose' },
    { name: 'Monitoring & alerts',                 colorId: 'rose' },
    { name: 'On-call rotations',                   colorId: 'rose' },
    { name: 'Root cause analysis',                 colorId: 'rose' },
    // 🟠 Infrastructure & ops
    { name: 'Deployments & releases',              colorId: 'orange' },
    { name: 'System patching & updates',           colorId: 'orange' },
    { name: 'Backups & disaster recovery',         colorId: 'orange' },
    { name: 'Network management',                  colorId: 'orange' },
    { name: 'Cloud infrastructure mgmt',           colorId: 'orange' },
    { name: 'Hardware provisioning',               colorId: 'orange' },
    // 🟡 Access, security & vendor
    { name: 'User access & permissions',           colorId: 'amber' },
    { name: 'Security & compliance tasks',         colorId: 'amber' },
    { name: 'Vendor & license mgmt',               colorId: 'amber' },
    // 🟢 Code & quality
    { name: 'Code & config changes',               colorId: 'emerald' },
    { name: 'Automation & scripting',              colorId: 'emerald' },
    { name: 'Testing & QA',                        colorId: 'emerald' },
    { name: 'Code reviews',                        colorId: 'emerald' },
    { name: 'Documentation',                       colorId: 'emerald' },
    // 🔵 Collaboration & comms
    { name: 'Email & Slack triage',                colorId: 'blue' },
    { name: 'Meetings & standups',                 colorId: 'blue' },
    { name: '1:1s',                                colorId: 'blue' },
    { name: 'Cross-functional collab',             colorId: 'blue' },
    { name: 'All-hands',                           colorId: 'blue' },
    { name: 'Informal chats',                      colorId: 'blue' },
    // 🟣 Planning & growth
    { name: 'Project planning',                    colorId: 'purple' },
    { name: 'Training & certifications',           colorId: 'purple' },
    // ⚪ Overhead
    { name: 'Lunch & breaks',                      colorId: 'slate' },
    { name: 'Context switching',                   colorId: 'slate' },
    { name: 'HR tasks',                            colorId: 'slate' },
  ],
  operations: [
    { name: 'Coordination',   colorId: 'blue' },
    { name: 'Admin',          colorId: 'slate' },
    { name: 'Planning',       colorId: 'purple' },
    { name: 'Meetings',       colorId: 'amber' },
    { name: 'Review',         colorId: 'emerald' },
    { name: 'Writing',        colorId: 'orange' },
  ],
  client: [
    { name: 'Client Work',    colorId: 'blue' },
    { name: 'Review',         colorId: 'emerald' },
    { name: 'Strategy',       colorId: 'purple' },
    { name: 'Revisions',      colorId: 'orange' },
    { name: 'Meetings',       colorId: 'amber' },
    { name: 'Admin',          colorId: 'slate' },
  ],
  general: [
    { name: 'Deep Work',      colorId: 'blue' },
    { name: 'Writing',        colorId: 'purple' },
    { name: 'Research',       colorId: 'teal' },
    { name: 'Meetings',       colorId: 'amber' },
    { name: 'Review',         colorId: 'emerald' },
    { name: 'Admin',          colorId: 'slate' },
  ],
};

export function getStarterPanels(roleId: string): StarterPanel[] {
  return STARTER_PACKS[roleId] ?? STARTER_PACKS.general;
}

/** Convert a set of StarterPanels into full MockPanel catalog entries. */
export function buildCatalogFromStarters(starters: StarterPanel[]): MockPanel[] {
  return starters.map(s => makePanel({ name: s.name, colorId: s.colorId }));
}

// ---- Summary Audience ----

export type SummaryAudience = 'manager' | 'internal' | 'client' | 'personal';

export const AUDIENCE_OPTIONS: { id: SummaryAudience; label: string; description: string }[] = [
  { id: 'manager',  label: 'Manager',  description: 'Status updates for leadership' },
  { id: 'internal', label: 'Internal', description: 'Team stand-ups and hand-offs' },
  { id: 'client',   label: 'Client',   description: 'External progress reports' },
  { id: 'personal', label: 'Personal', description: 'Self-tracking and reflection' },
];

// ---- Persistence ----

const ONBOARDING_KEY = 'taskpanels.onboarding.v1';

export interface OnboardingResult {
  completedAt: number;
  roleId: string;
  audience: SummaryAudience;
}

export function loadOnboarding(): OnboardingResult | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingResult;
    if (!parsed || !parsed.completedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveOnboarding(result: OnboardingResult): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(result));
  } catch {
    /* quota or privacy mode — ignore */
  }
}

export function clearOnboarding(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    /* ignore */
  }
}
