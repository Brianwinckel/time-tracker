// ============================================================
// Lightweight SVG charts — no external dependencies
// ============================================================

import React from 'react';
import { formatDurationShort } from '../utils/time';

// ---- Horizontal Bar Chart ----

interface BarChartProps {
  data: { label: string; value: number; color: string }[];
  title?: string;
  formatValue?: (v: number) => string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  formatValue = (v) => formatDurationShort(v),
}) => {
  if (data.length === 0) return null;
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className="chart-bar">
      {title && <h4 className="chart-bar__title">{title}</h4>}
      <div className="chart-bar__rows">
        {data.map((d, i) => (
          <div key={i} className="chart-bar__row">
            <span className="chart-bar__label">{d.label}</span>
            <div className="chart-bar__track">
              <div
                className="chart-bar__fill"
                style={{
                  width: `${maxValue > 0 ? (d.value / maxValue) * 100 : 0}%`,
                  backgroundColor: d.color,
                }}
              />
            </div>
            <span className="chart-bar__value">{formatValue(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- Stacked Bar ----

interface StackedBarProps {
  segments: { label: string; value: number; color: string }[];
  title?: string;
}

export const StackedBar: React.FC<StackedBarProps> = ({ segments, title }) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  return (
    <div className="chart-stacked">
      {title && <h4 className="chart-stacked__title">{title}</h4>}
      <div className="chart-stacked__bar">
        {segments.filter(s => s.value > 0).map((seg, i) => (
          <div
            key={i}
            className="chart-stacked__segment"
            style={{
              width: `${(seg.value / total) * 100}%`,
              backgroundColor: seg.color,
            }}
            title={`${seg.label}: ${formatDurationShort(seg.value)}`}
          />
        ))}
      </div>
      <div className="chart-stacked__legend">
        {segments.filter(s => s.value > 0).map((seg, i) => (
          <span key={i} className="chart-stacked__legend-item">
            <span className="chart-stacked__dot" style={{ backgroundColor: seg.color }} />
            {seg.label}: {formatDurationShort(seg.value)}
          </span>
        ))}
      </div>
    </div>
  );
};

// ---- Status Count Badges ----

interface StatusCountsProps {
  counts: Record<string, number>;
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  'Completed': '#50B86C',
  'In Progress': '#F5A623',
  'Waiting for Review': '#00BCD4',
  'Waiting for Approval': '#9B59B6',
  'Blocked': '#E85D75',
  'Deferred': '#607D8B',
  'Shelved': '#795548',
  'Scrapped': '#FF7043',
};

export const StatusCounts: React.FC<StatusCountsProps> = ({ counts }) => {
  const entries = Object.entries(counts).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;

  return (
    <div className="chart-status-counts">
      {entries.map(([status, count]) => {
        const color = STATUS_BADGE_COLORS[status] || '#607D8B';
        return (
          <div
            key={status}
            className="chart-status-count"
            style={{ borderColor: color, color }}
          >
            <span className="chart-status-count__number">{count}</span>
            <span className="chart-status-count__label">{status}</span>
          </div>
        );
      })}
    </div>
  );
};
