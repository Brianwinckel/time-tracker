// ============================================================
// Reusable tag chip selector — horizontal scrollable pills
// Used for Project, Value Category, Work Style, Output Type, Status
// ============================================================

import React, { useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { TagCategory, TagOption } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import * as storage from '../storage';

interface Props {
  category: TagCategory;
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  compact?: boolean; // smaller chips for inline use
  allowClear?: boolean;
  allowAdd?: boolean;
}

const CATEGORY_LABELS: Record<TagCategory, string> = {
  project: 'Project',
  value_category: 'Value',
  work_style: 'Style',
  output_type: 'Output',
  session_status: 'Status',
};

export const TagSelector: React.FC<Props> = ({
  category,
  value,
  onChange,
  label,
  compact = false,
  allowClear = true,
  allowAdd = true,
}) => {
  const { state, dispatch } = useApp();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');

  const options = state.tagOptions.filter(o => o.category === category);
  const displayLabel = label ?? CATEGORY_LABELS[category];

  const handleAdd = () => {
    if (!newValue.trim() || !user?.id) return;

    const option: TagOption = {
      id: uuid(),
      userId: user.id,
      category,
      value: newValue.trim(),
      color: '#607D8B',
      sortOrder: options.length,
      isDefault: false,
      isArchived: false,
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_TAG_OPTION', option });
    storage.saveTagOption(option);
    onChange(option.value);
    setNewValue('');
    setAdding(false);
  };

  return (
    <div className={`tag-selector ${compact ? 'tag-selector--compact' : ''}`}>
      {displayLabel && (
        <span className="tag-selector__label">{displayLabel}</span>
      )}
      <div className="tag-selector__chips">
        {allowClear && value && (
          <button
            type="button"
            className="tag-chip tag-chip--clear"
            onClick={() => onChange(null)}
            title="Clear"
          >
            &times;
          </button>
        )}
        {options.map(opt => (
          <button
            key={opt.id}
            type="button"
            className={`tag-chip ${value === opt.value ? 'tag-chip--selected' : ''}`}
            style={{
              '--chip-color': opt.color,
              borderColor: value === opt.value ? opt.color : 'transparent',
              backgroundColor: value === opt.value ? opt.color + '20' : undefined,
              color: value === opt.value ? opt.color : undefined,
            } as React.CSSProperties}
            onClick={() => onChange(value === opt.value ? null : opt.value)}
          >
            {opt.value}
          </button>
        ))}
        {allowAdd && !adding && (
          <button
            type="button"
            className="tag-chip tag-chip--add"
            onClick={() => setAdding(true)}
          >
            +
          </button>
        )}
        {adding && (
          <span className="tag-selector__add-input">
            <input
              type="text"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
                if (e.key === 'Escape') setAdding(false);
              }}
              placeholder="New..."
              autoFocus
              maxLength={40}
            />
            <button type="button" onClick={handleAdd} className="tag-chip tag-chip--confirm">
              &#10003;
            </button>
          </span>
        )}
      </div>
    </div>
  );
};
