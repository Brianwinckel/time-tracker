// ============================================================
// summaryExport — plain-text rendering for Copy / Email
// ------------------------------------------------------------
// Turns a DailySummaryData (the generator output) into a
// readable monospace-friendly text block. Used by:
//   * The Copy button → pastes into clipboard verbatim
//   * The Email button → injected into the mailto body
//
// Design rules:
//   1. No lib dependencies — pure string assembly so this
//      stays cheap to call and tree-shakes cleanly.
//   2. ASCII-friendly. Avoid box-drawing chars that break in
//      plain-text email clients (Outlook especially).
//   3. Sections collapse when empty. A day with no blockers
//      shouldn't print a "Blockers:" header followed by nothing.
//   4. Strip the markdown **bold** markers that show up in the
//      generator narrative — they read as literal asterisks in
//      a text context.
//   5. Footer always includes the date-generated stamp and a
//      TaskPanels attribution line so forwarded reports carry
//      the origin with them.
// ============================================================

import type { DailySummaryData } from './summaryModel';

const APP_URL = 'https://app.taskpanels.app';
const APP_NAME = 'TaskPanels';

/** Build the plain-text Daily Work Summary that the Copy and
 *  Email buttons produce. `dateLabel` is passed in separately
 *  because the generator's `dateLabel` field is human-formatted
 *  and we want the caller to be able to override for archive
 *  contexts (e.g. historical dates). */
export function toPlainText(data: DailySummaryData): string {
  const lines: string[] = [];

  // ---- Title block ----
  lines.push(data.title.toUpperCase());
  lines.push(data.dateLabel);
  lines.push(divider());
  lines.push('');

  // ---- KPIs (flat list — tables read badly in plain text) ----
  if (data.kpis.length > 0) {
    for (const kpi of data.kpis) {
      const sub = kpi.sub ? ` (${kpi.sub})` : '';
      lines.push(`${kpi.label.padEnd(14)} ${kpi.value}${sub}`);
    }
    lines.push('');
  }

  // ---- Narrative ----
  if (data.narrative.length > 0) {
    lines.push('SUMMARY');
    lines.push(divider('-'));
    for (const paragraph of data.narrative) {
      lines.push(stripMarkdownBold(paragraph));
      lines.push('');
    }
  }

  // ---- Time by panel ----
  if (data.legend.length > 0) {
    lines.push('TIME BY PANEL');
    lines.push(divider('-'));
    const maxNameLen = Math.max(...data.legend.map(l => l.name.length));
    const namePad = Math.min(maxNameLen, 28); // cap at 28 so lines stay readable
    for (const entry of data.legend) {
      const name = truncate(entry.name, namePad).padEnd(namePad);
      lines.push(`${name}  ${entry.time.padStart(8)}  ${String(entry.pct).padStart(3)}%`);
    }
    lines.push('');
  }

  // ---- Timeline ----
  if (data.timeline.length > 0) {
    lines.push('TIMELINE');
    lines.push(divider('-'));
    for (const row of data.timeline) {
      const prefix = row.kind === 'work' ? ' ' : '·'; // subtle pause marker
      const name = truncate(row.name, 30).padEnd(30);
      lines.push(`${prefix} ${row.startLabel.padStart(5)}  ${name}  ${row.duration.padStart(7)}`);
    }
    lines.push('');
  }

  // ---- Completed / Follow-ups / Blockers ----
  if (data.completed.length > 0) {
    lines.push('COMPLETED');
    lines.push(divider('-'));
    for (const item of data.completed) {
      lines.push(`+ ${item}`);
    }
    lines.push('');
  }

  if (data.followUps.length > 0) {
    lines.push('FOLLOW-UPS');
    lines.push(divider('-'));
    for (const item of data.followUps) {
      lines.push(`> ${item}`);
    }
    lines.push('');
  }

  if (data.blockers.length > 0) {
    lines.push('BLOCKERS');
    lines.push(divider('-'));
    for (const item of data.blockers) {
      lines.push(`! ${item}`);
    }
    lines.push('');
  }

  // ---- Overtime banner (only when the day ran long) ----
  if (data.overtime.isOver) {
    lines.push(
      `Overtime: ${data.overtime.overLabel} past the ${data.overtime.thresholdLabel} daily threshold.`,
    );
    lines.push('');
  }

  // ---- Footer ----
  lines.push(divider());
  lines.push(`Generated with ${APP_NAME} · ${APP_URL}`);

  // Collapse any accidental triple blank lines back to a double.
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Build the subject + body for the Email button's mailto link.
 *  The body has a short "PDF version available" nudge appended
 *  so users who want the branded PDF know where to find it.
 *  Returns raw strings — the caller is responsible for URL-
 *  encoding them into a mailto: href. */
export function toEmailParts(data: DailySummaryData): {
  subject: string;
  body: string;
} {
  const subject = `${data.title} — ${data.dateLabel}`;
  const body =
    toPlainText(data) +
    '\n\n' +
    `A PDF version of this report is available via the Download button in ${APP_NAME}.`;
  return { subject, body };
}

/** Assemble the full `mailto:` href. Pass an optional recipient
 *  address; omitting it opens the user's mail client with the
 *  To: field blank so they can pick. */
export function buildMailtoUrl(
  data: DailySummaryData,
  recipient: string = '',
): string {
  const { subject, body } = toEmailParts(data);
  const qs =
    `subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;
  return `mailto:${recipient}?${qs}`;
}

/** Strip `**bold**` markdown markers that the deterministic
 *  narrative generator sprinkles in. They render as literal
 *  asterisks in plain text contexts — not useful. */
export function stripMarkdownBold(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '$1');
}

function divider(ch: string = '='): string {
  return ch.repeat(56);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '…';
}
