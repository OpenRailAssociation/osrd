import React, { useId, useState } from 'react';

enum colorClasses {
  primary = 'bg-primary',
  secondary = 'bg-secondary',
  purple = 'bg-purple',
  pink = 'bg-pink',
  red = 'bg-red',
  orange = 'bg-orange',
  yellow = 'bg-yellow text-dark',
  green = 'bg-green text-dark',
  teal = 'bg-teal text-dark',
  cyan = 'bg-cyan',
  white = 'bg-white text-dark',
}

type Props = {
  tags?: string[];
  addTag: (tag: string) => void;
  removeTag: (tagIdx: number) => void;
  title?: React.JSX.Element | string;
  color?: string;
};

/**
 * ChipsSNCF is a chip input component for an array of unique string tags (e.g., for trains, studies, scenarios, projects).
 *
 * The tags array is not directly mutated, only through provided addTag and removeTag callbacks.
 * addTag is only called if the inputted tag is not already present in the tags array.
 */
export default function ChipsSNCF({
  tags = [],
  addTag,
  removeTag,
  title,
  color = 'primary',
}: Props) {
  const [chipInputValue, setChipInputValue] = useState('');

  const chip = (label: string, idx: number) => {
    const chipColor = colorClasses[color as keyof typeof colorClasses];
    return (
      <div role="list" key={label}>
        <div className="chips-group" role="listitem">
          <span
            data-testid="scenario-details-tag"
            className={`chips chips-label pr-1 ${chipColor}`}
          >
            {label}
          </span>
          <button
            type="button"
            className={`chips chips-btn chips-only-icon ${chipColor}`}
            aria-label="remove tag"
            onClick={() => removeTag(idx)}
          >
            <i className="icons-close" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  };

  const validateInput = (
    e: React.KeyboardEvent<HTMLInputElement> & { target: HTMLInputElement }
  ) => {
    if (e.key === 'Enter' && e.target) {
      if (!tags.includes(e.target.value)) addTag(e.target.value);
      setChipInputValue('');
    }
  };

  const chipsID = `chipsSNCF${useId()}`;
  return (
    <div className="chips-container">
      {title && (
        <label className="font-weight-medium mb-2" htmlFor={chipsID}>
          {title}
        </label>
      )}
      <div className="form-chips-container">
        {tags && tags.map((label, idx) => chip(label, idx))}
        <input
          data-role="typewriter"
          type="text"
          data-testid="chips-input"
          className="chips-input"
          id={chipsID}
          onKeyDown={validateInput}
          value={chipInputValue}
          onChange={(e) => setChipInputValue(e.target.value)}
        />
      </div>
    </div>
  );
}
