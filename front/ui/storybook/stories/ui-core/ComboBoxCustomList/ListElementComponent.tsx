import React from 'react';

import cx from 'classnames';

import './ListElementComponent.scss';

export type secondaryCodeSuggestion = {
  code: string;
  isCandidate?: boolean;
  isBestSuggestion?: boolean;
};

export type OperationalPointSuggestion = {
  id: string;
  trigram: string;
  name: string;
  chList: secondaryCodeSuggestion[];
};

export type ListElementComponentProps = {
  suggestion: OperationalPointSuggestion;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  onPickSecondaryCode?: (code: string) => void;
};

export const ListElementComponent = ({
  suggestion,
  isActive,
  isSelected,
  onPickSecondaryCode: onPickCh,
}: ListElementComponentProps) => (
  <div
    className={cx('op-suggestion', {
      'op-suggestion--active': isActive,
      'op-suggestion--selected': isSelected,
    })}
  >
    <span className="op-suggestion-trigram">{suggestion.trigram}</span>
    <span className="op-suggestion-name">{suggestion.name}</span>

    <div className="op-suggestion-secondary-code-list">
      {suggestion.chList.map((ch) => (
        <span
          key={ch.code}
          className={cx('op-suggestion-secondary-code', {
            'op-suggestion-secondary-code--best': ch.isBestSuggestion,
            'op-suggestion-secondary-code--inactive': ch.isCandidate === false,
          })}
          onClick={(e) => {
            e.preventDefault();
            onPickCh?.(ch.code);
          }}
        >
          {ch.code}
        </span>
      ))}
    </div>
  </div>
);
