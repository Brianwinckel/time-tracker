// ============================================================
// summaryPdf — branded PDF export for Daily Work Summary
// ------------------------------------------------------------
// Produces a single-file, selectable-text PDF of a
// DailySummaryData using jspdf. The report layout mirrors the
// on-screen DailyWorkSummaryScreen at a high level:
//
//   [ header band: logo + wordmark + URL ]
//   [ title block: "Daily Work Summary" + date ]
//   [ KPI tiles row ]
//   [ Summary narrative ]
//   [ Time by Panel bars ]
//   [ Timeline ]
//   [ Completed / Follow-ups / Blockers ]
//   [ footer: generated timestamp + URL ]
//
// This module is dynamic-imported from the screen handler so
// the ~100kb jspdf bundle only loads when the user actually
// clicks Download. Keep side-effect-free imports out of the
// top level to protect code-splitting.
//
// Coordinate system:
//   jspdf's default unit is "pt" (1/72 inch). Letter page is
//   612 × 792 pt. All drawing functions return the next free
//   `y` so the main `generate()` pipeline threads them in
//   order. On overflow we call `doc.addPage()` and reset y
//   via `newPageIfNeeded(y, height)`.
// ============================================================

import type { jsPDF } from 'jspdf';
import type { DailySummaryData, KPI, LegendEntry, TimelineEntry } from './summaryModel';
import { stripMarkdownBold } from './summaryExport';

// ---- Page geometry ----
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 40;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 50; // leaves room for the footer line
const CONTENT_W = PAGE_W - MARGIN_X * 2;

// ---- Color palette (matches the app Tailwind palette) ----
// jspdf's setFillColor/setTextColor accept r,g,b ints. Keeping
// these as tuples avoids a hex-parse pass on every call.
type RGB = [number, number, number];
const COLORS = {
  slate900: [15, 23, 42] as RGB,
  slate800: [30, 41, 59] as RGB,
  slate700: [51, 65, 85] as RGB,
  slate500: [100, 116, 139] as RGB,
  slate400: [148, 163, 184] as RGB,
  slate300: [203, 213, 225] as RGB,
  slate200: [226, 232, 240] as RGB,
  slate100: [241, 245, 249] as RGB,
  slate50: [248, 250, 252] as RGB,
  white: [255, 255, 255] as RGB,
  blue500: [59, 130, 246] as RGB,
  blue100: [219, 234, 254] as RGB,
  emerald500: [16, 185, 129] as RGB,
  emerald100: [209, 250, 229] as RGB,
  amber500: [245, 158, 11] as RGB,
  amber100: [254, 243, 199] as RGB,
  rose500: [225, 29, 72] as RGB,
  rose100: [255, 228, 230] as RGB,
  purple500: [139, 92, 246] as RGB,
  purple100: [237, 233, 254] as RGB,
  orange500: [249, 115, 22] as RGB,
  orange100: [255, 237, 213] as RGB,
};

const APP_URL = 'app.taskpanels.app';
const APP_NAME = 'TaskPanels';

// ============================================================
// Entry point
// ============================================================

/** Generate the daily-summary PDF and return it as a Blob. The
 *  caller is responsible for turning it into a download via
 *  createObjectURL + anchor click. Returns a Promise because
 *  we dynamic-import jspdf at runtime. */
export async function generateDailySummaryPdf(
  data: DailySummaryData,
): Promise<Blob> {
  // Dynamic import keeps jspdf out of the main bundle.
  const { jsPDF: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ unit: 'pt', format: 'letter' });

  let y = MARGIN_TOP;

  // Header band + title live on the first page only — subsequent
  // pages get a lightweight page number footer automatically via
  // the final loop at the bottom of this function.
  y = drawHeader(doc, y);
  y = drawTitleBlock(doc, y, data);
  y = drawKpiRow(doc, y, data.kpis);

  if (data.narrative.length > 0) {
    y = ensureRoom(doc, y, 60);
    y = drawSectionHeader(doc, y, 'Summary');
    y = drawNarrative(doc, y, data.narrative);
  }

  if (data.legend.length > 0) {
    y = ensureRoom(doc, y, 80);
    y = drawSectionHeader(doc, y, 'Time by Panel');
    y = drawLegend(doc, y, data.legend);
  }

  if (data.timeline.length > 0) {
    y = ensureRoom(doc, y, 80);
    y = drawSectionHeader(doc, y, 'Timeline');
    y = drawTimeline(doc, y, data.timeline);
  }

  if (data.completed.length > 0) {
    y = ensureRoom(doc, y, 60);
    y = drawSectionHeader(doc, y, 'Completed');
    y = drawBulletList(doc, y, data.completed, COLORS.emerald500);
  }

  if (data.followUps.length > 0) {
    y = ensureRoom(doc, y, 60);
    y = drawSectionHeader(doc, y, 'Follow-ups');
    y = drawBulletList(doc, y, data.followUps, COLORS.amber500);
  }

  if (data.blockers.length > 0) {
    y = ensureRoom(doc, y, 60);
    y = drawSectionHeader(doc, y, 'Blockers');
    y = drawBulletList(doc, y, data.blockers, COLORS.rose500);
  }

  if (data.overtime.isOver) {
    y = ensureRoom(doc, y, 60);
    y = drawOvertimeBanner(doc, y, data.overtime);
  }

  // Walk every page and stamp the footer bar. Doing this at the
  // very end means we know the final page count for "Page N of M".
  stampFootersOnEveryPage(doc, data);

  return doc.output('blob');
}

// ============================================================
// Header / title / footer
// ============================================================

/** Brand header: logo (4 dots) + "TaskPanels" wordmark on the
 *  left, "app.taskpanels.app" URL on the right. Sits at the top
 *  of page 1 only. */
function drawHeader(doc: jsPDF, y: number): number {
  const startY = y;
  // Four-dot logo matching the in-app SVG
  const dotR = 4;
  const dotGap = 3;
  const logoX = MARGIN_X + dotR;
  const logoY = startY + dotR + 2;
  // Top-left: blue
  setFill(doc, COLORS.blue500);
  doc.circle(logoX, logoY, dotR, 'F');
  // Top-right: orange
  setFill(doc, COLORS.orange500);
  doc.circle(logoX + dotR * 2 + dotGap, logoY, dotR, 'F');
  // Bottom-left: purple
  setFill(doc, COLORS.purple500);
  doc.circle(logoX, logoY + dotR * 2 + dotGap, dotR, 'F');
  // Bottom-right: emerald
  setFill(doc, COLORS.emerald500);
  doc.circle(logoX + dotR * 2 + dotGap, logoY + dotR * 2 + dotGap, dotR, 'F');

  // Wordmark to the right of the logo
  setText(doc, COLORS.slate900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(APP_NAME, MARGIN_X + 28, startY + 14);

  // URL on the far right, aligned baseline
  setText(doc, COLORS.slate400);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(APP_URL, PAGE_W - MARGIN_X, startY + 14, { align: 'right' });

  // Thin divider line
  setDraw(doc, COLORS.slate200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, startY + 26, PAGE_W - MARGIN_X, startY + 26);

  return startY + 38;
}

/** Big report title + date label. */
function drawTitleBlock(
  doc: jsPDF,
  y: number,
  data: DailySummaryData,
): number {
  setText(doc, COLORS.slate900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(data.title, MARGIN_X, y + 18);

  setText(doc, COLORS.slate500);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(data.dateLabel, MARGIN_X, y + 32);

  return y + 50;
}

/** Footer run on every page: generated-at timestamp on the left,
 *  "Page N of M · TaskPanels" on the right. Called once after all
 *  content is drawn so we know the final page count. */
function stampFootersOnEveryPage(doc: jsPDF, _data: DailySummaryData): void {
  const total = doc.getNumberOfPages();
  const stamp = new Date().toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    setDraw(doc, COLORS.slate200);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_X, PAGE_H - MARGIN_BOTTOM + 10, PAGE_W - MARGIN_X, PAGE_H - MARGIN_BOTTOM + 10);

    setText(doc, COLORS.slate400);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Generated ${stamp}`, MARGIN_X, PAGE_H - MARGIN_BOTTOM + 22);
    doc.text(
      `Page ${i} of ${total} · ${APP_NAME} · ${APP_URL}`,
      PAGE_W - MARGIN_X,
      PAGE_H - MARGIN_BOTTOM + 22,
      { align: 'right' },
    );
  }
}

// ============================================================
// KPI row
// ============================================================

/** Four KPI tiles stretched across the content width. Each tile
 *  has a tinted background, a large value, the label, and an
 *  optional subtitle. */
function drawKpiRow(doc: jsPDF, y: number, kpis: KPI[]): number {
  if (kpis.length === 0) return y;
  const TILE_H = 60;
  const GAP = 8;
  const count = Math.min(kpis.length, 4);
  const tileW = (CONTENT_W - GAP * (count - 1)) / count;

  const tints: Array<{ bg: RGB; fg: RGB }> = [
    { bg: [239, 246, 255], fg: COLORS.blue500 },
    { bg: COLORS.emerald100, fg: COLORS.emerald500 },
    { bg: COLORS.purple100, fg: COLORS.purple500 },
    { bg: COLORS.orange100, fg: COLORS.orange500 },
  ];

  for (let i = 0; i < count; i++) {
    const x = MARGIN_X + (tileW + GAP) * i;
    const kpi = kpis[i];
    const tint = tints[i % tints.length];

    setFill(doc, tint.bg);
    doc.roundedRect(x, y, tileW, TILE_H, 6, 6, 'F');

    // Value
    setText(doc, tint.fg);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(kpi.value, x + 12, y + 24);

    // Label (uppercase, small)
    setText(doc, tint.fg);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(kpi.label.toUpperCase(), x + 12, y + 38);

    // Subtitle
    if (kpi.sub) {
      setText(doc, COLORS.slate500);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(truncateForWidth(doc, kpi.sub, tileW - 24), x + 12, y + 50);
    }
  }

  return y + TILE_H + 20;
}

// ============================================================
// Section scaffolding
// ============================================================

/** Tiny uppercase label acting as a section divider. */
function drawSectionHeader(doc: jsPDF, y: number, title: string): number {
  setText(doc, COLORS.slate400);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(title.toUpperCase(), MARGIN_X, y);
  setDraw(doc, COLORS.slate200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, y + 5, PAGE_W - MARGIN_X, y + 5);
  return y + 18;
}

// ============================================================
// Narrative
// ============================================================

/** Wrap the generator's narrative paragraphs to the content
 *  width. Strips the markdown-style **bold** markers that
 *  read as literal asterisks in flat text. */
function drawNarrative(
  doc: jsPDF,
  y: number,
  paragraphs: string[],
): number {
  setText(doc, COLORS.slate700);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lineHeight = 13;
  let cursor = y;
  for (const p of paragraphs) {
    const clean = stripMarkdownBold(p);
    const lines = doc.splitTextToSize(clean, CONTENT_W) as string[];
    for (const line of lines) {
      cursor = ensureRoom(doc, cursor, lineHeight);
      doc.text(line, MARGIN_X, cursor);
      cursor += lineHeight;
    }
    cursor += 4; // paragraph gap
  }
  return cursor + 8;
}

// ============================================================
// Time by Panel
// ============================================================

/** One row per legend entry: colored swatch, name, formatted
 *  time, percentage, and a thin proportional bar below the
 *  name. */
function drawLegend(
  doc: jsPDF,
  y: number,
  entries: LegendEntry[],
): number {
  const ROW_H = 28;
  let cursor = y;
  for (const entry of entries) {
    cursor = ensureRoom(doc, cursor, ROW_H);

    // Color swatch
    setFill(doc, hexToRgb(entry.colorHex));
    doc.circle(MARGIN_X + 5, cursor + 4, 4, 'F');

    // Name
    setText(doc, COLORS.slate900);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const nameMax = CONTENT_W - 120;
    doc.text(truncateForWidth(doc, entry.name, nameMax), MARGIN_X + 16, cursor + 7);

    // Time + pct aligned right
    setText(doc, COLORS.slate500);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${entry.time}`, PAGE_W - MARGIN_X - 40, cursor + 7, { align: 'right' });
    setText(doc, COLORS.slate400);
    doc.setFontSize(9);
    doc.text(`${entry.pct}%`, PAGE_W - MARGIN_X, cursor + 7, { align: 'right' });

    // Proportional bar
    const barY = cursor + 14;
    const barW = CONTENT_W - 16;
    setFill(doc, COLORS.slate100);
    doc.roundedRect(MARGIN_X + 16, barY, barW, 4, 2, 2, 'F');
    setFill(doc, hexToRgb(entry.colorHex));
    const fillW = Math.max(2, (entry.pct / 100) * barW);
    doc.roundedRect(MARGIN_X + 16, barY, fillW, 4, 2, 2, 'F');

    cursor += ROW_H;
  }
  return cursor + 8;
}

// ============================================================
// Timeline
// ============================================================

/** Time-of-day rows. Each entry gets a start-time label, the
 *  panel name, and its duration aligned right. We cap very long
 *  timelines at 40 rows so the PDF doesn't explode into dozens
 *  of pages — the footer already notes this is a summary. */
function drawTimeline(
  doc: jsPDF,
  y: number,
  entries: TimelineEntry[],
): number {
  const ROW_H = 18;
  const MAX_ROWS = 40;
  const shown = entries.slice(0, MAX_ROWS);
  const hidden = entries.length - shown.length;
  let cursor = y;

  for (const row of shown) {
    cursor = ensureRoom(doc, cursor, ROW_H);

    // Accent bar (vertical pill to the left of the row)
    setFill(doc, hexToRgb(row.colorHex));
    doc.roundedRect(MARGIN_X, cursor - 8, 2, 10, 1, 1, 'F');

    // Start time label
    setText(doc, COLORS.slate400);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(row.startLabel, MARGIN_X + 8, cursor);

    // Name
    setText(doc, COLORS.slate800);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const nameMax = CONTENT_W - 140;
    doc.text(
      truncateForWidth(doc, row.name, nameMax),
      MARGIN_X + 50,
      cursor,
    );

    // Duration right-aligned
    setText(doc, COLORS.slate500);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(row.duration, PAGE_W - MARGIN_X, cursor, { align: 'right' });

    cursor += ROW_H;
  }

  if (hidden > 0) {
    cursor = ensureRoom(doc, cursor, ROW_H);
    setText(doc, COLORS.slate400);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text(
      `+ ${hidden} more segment${hidden === 1 ? '' : 's'} not shown`,
      MARGIN_X + 8,
      cursor,
    );
    cursor += ROW_H;
  }

  return cursor + 8;
}

// ============================================================
// Outcome lists (Completed / Follow-ups / Blockers)
// ============================================================

function drawBulletList(
  doc: jsPDF,
  y: number,
  items: string[],
  accent: RGB,
): number {
  const lineH = 13;
  let cursor = y;
  setText(doc, COLORS.slate700);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const item of items) {
    // Wrap the item text first so we can figure out row height
    // and draw the bullet flush with the top line only.
    const wrapped = doc.splitTextToSize(item, CONTENT_W - 20) as string[];
    const blockH = wrapped.length * lineH;
    cursor = ensureRoom(doc, cursor, blockH + 2);

    setFill(doc, accent);
    doc.circle(MARGIN_X + 4, cursor - 3, 2, 'F');

    setText(doc, COLORS.slate700);
    for (let i = 0; i < wrapped.length; i++) {
      doc.text(wrapped[i], MARGIN_X + 14, cursor + i * lineH);
    }
    cursor += blockH + 4;
  }
  return cursor + 6;
}

// ============================================================
// Overtime banner
// ============================================================

function drawOvertimeBanner(
  doc: jsPDF,
  y: number,
  overtime: DailySummaryData['overtime'],
): number {
  const BANNER_H = 34;
  setFill(doc, [254, 242, 242]); // rose-50
  doc.roundedRect(MARGIN_X, y, CONTENT_W, BANNER_H, 6, 6, 'F');
  setDraw(doc, COLORS.rose500);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN_X, y, CONTENT_W, BANNER_H, 6, 6, 'S');

  setText(doc, COLORS.rose500);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Overtime', MARGIN_X + 12, y + 14);

  setText(doc, COLORS.slate700);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Worked ${overtime.workedLabel}, ${overtime.overLabel} past the ${overtime.thresholdLabel} daily threshold.`,
    MARGIN_X + 12,
    y + 26,
  );

  return y + BANNER_H + 12;
}

// ============================================================
// Layout helpers
// ============================================================

/** If the next `need` units would overflow the page bottom,
 *  add a new page and reset the cursor to the top margin.
 *  Returns the (possibly new) cursor y. */
function ensureRoom(doc: jsPDF, y: number, need: number): number {
  const maxY = PAGE_H - MARGIN_BOTTOM;
  if (y + need > maxY) {
    doc.addPage();
    return MARGIN_TOP;
  }
  return y;
}

/** Alias — reads more naturally at the top of `generate()`. */
function newPageIfNeeded(doc: jsPDF, y: number, need: number): number {
  return ensureRoom(doc, y, need);
}
// Silence the "declared but unused" warning without dropping
// the helper — it's handy when iterating on the layout.
void newPageIfNeeded;

function setFill(doc: jsPDF, rgb: RGB): void {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setText(doc: jsPDF, rgb: RGB): void {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function setDraw(doc: jsPDF, rgb: RGB): void {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

/** Parse a `#rrggbb` hex string into an [r,g,b] tuple. Falls
 *  back to slate-400 if the input is missing/malformed — that
 *  way a legend entry with a bad color can't crash export. */
function hexToRgb(hex: string | undefined): RGB {
  if (!hex || hex[0] !== '#' || hex.length !== 7) return COLORS.slate400;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return COLORS.slate400;
  return [r, g, b];
}

/** Truncate a string so `doc.getTextWidth(...)` fits under
 *  `maxW`. Used when we don't want to lean on `splitTextToSize`
 *  because we want a single line with an ellipsis. */
function truncateForWidth(
  doc: jsPDF,
  text: string,
  maxW: number,
): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  const ell = '…';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const candidate = text.slice(0, mid) + ell;
    if (doc.getTextWidth(candidate) <= maxW) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return text.slice(0, lo) + ell;
}

// ============================================================
// Caller helper: download a Blob
// ============================================================

/** Trigger a browser download for the given blob. Shared
 *  with future export paths so we don't re-implement the
 *  anchor-click dance at every callsite. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the browser has time to start
  // the download before we invalidate the blob URL.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Compose a filename-safe filename from a DailySummaryData
 *  dateLabel. "Monday, April 14, 2026" → "taskpanels-daily-2026-04-14.pdf".
 *  Falls back to a timestamp if the caller passes an ISO date
 *  instead of a humanized label. */
export function filenameForSummary(dateLabel: string): string {
  // Try to extract a YYYY-MM-DD directly; otherwise parse.
  const isoMatch = dateLabel.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `taskpanels-daily-${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}.pdf`;
  }
  const d = new Date(dateLabel);
  if (!Number.isNaN(d.getTime())) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `taskpanels-daily-${iso}.pdf`;
  }
  return `taskpanels-daily-${Date.now()}.pdf`;
}
