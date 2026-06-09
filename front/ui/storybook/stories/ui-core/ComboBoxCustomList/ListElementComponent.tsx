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
  mainCode: string;
  name: string;
  secondaryCodeList: secondaryCodeSuggestion[];
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
    <span className="op-suggestion-main-code">{suggestion.mainCode}</span>
    <span className="op-suggestion-name">{suggestion.name}</span>

    <div className="op-suggestion-secondary-code-list">
      {suggestion.secondaryCodeList.map((secondaryCode) => (
        <span
          key={secondaryCode.code}
          className={cx('op-suggestion-secondary-code', {
            'op-suggestion-secondary-code--best': secondaryCode.isBestSuggestion,
            'op-suggestion-secondary-code--inactive': secondaryCode.isCandidate === false,
          })}
          onClick={(e) => {
            e.preventDefault();
            onPickCh?.(secondaryCode.code);
          }}
        >
          {secondaryCode.code}
        </span>
      ))}
    </div>
  </div>
);
