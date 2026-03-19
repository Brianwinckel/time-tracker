// ============================================================
// Task color palette — vibrant but not garish
// ============================================================

export const TASK_COLORS = [
  '#4A90D9', // blue
  '#E85D75', // coral red
  '#50B86C', // green
  '#F5A623', // amber
  '#9B59B6', // purple
  '#00BCD4', // teal
  '#FF7043', // deep orange
  '#8BC34A', // light green
  '#E91E63', // pink
  '#607D8B', // blue grey
  '#FF9800', // orange
  '#3F51B5', // indigo
  '#009688', // dark teal
  '#795548', // brown
  '#CDDC39', // lime
  '#673AB7', // deep purple
] as const;

export function getNextColor(usedColors: string[]): string {
  const available = TASK_COLORS.filter(c => !usedColors.includes(c));
  return available.length > 0
    ? available[0]
    : TASK_COLORS[Math.floor(Math.random() * TASK_COLORS.length)];
}

// Determine if text should be white or black on a given bg color
export function getContrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1a1a2e' : '#ffffff';
}
