import { useState } from 'react';

import cx from 'classnames';

import './ListElementComponent.scss';

export type OpSecondaryCode = {
  code: string;
  opId?: string;
  isCandidate?: boolean;
  isBestSuggestion?: boolean;
};

export type OperationalPointSuggestion = {
  id: string;
  mainCode: string;
  uic?: number | null;
  name: string;
  secondaryCodeList: OpSecondaryCode[];
};

export type ListElementComponentProps = {
  suggestion: OperationalPointSuggestion;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  onSelect?: (op: OperationalPointSuggestion, secondaryCode?: string) => void;
};

export const ListElementComponent = ({
  suggestion,
  isActive,
  isSelected,
  onSelect,
}: ListElementComponentProps) => {
  const [isNameHovered, setIsNameHovered] = useState(false);

  return (
    <div
      className={cx('op-suggestion', {
        'op-suggestion--active': isActive,
        'op-suggestion--selected': isSelected,
        'op-suggestion--name-hovered': isNameHovered,
      })}
      data-testid={'op-suggestion'}
      role="button"
      tabIndex={0}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const defaultSecondaryCode = suggestion.secondaryCodeList?.[0]?.code;
        onSelect?.(suggestion, defaultSecondaryCode);
      }}
    >
      <span className="op-suggestion-main-code">{suggestion.mainCode}</span>

      <span
        className="op-suggestion-name"
        onMouseEnter={() => setIsNameHovered(true)}
        onMouseLeave={() => setIsNameHovered(false)}
      >
        {suggestion.name}
      </span>

      <div className="op-suggestion-secondary-code-list">
        {suggestion.secondaryCodeList.map((secondaryCode) => (
          <button
            key={secondaryCode.code}
            type="button"
            className={cx('op-suggestion-secondary-code', {
              'op-suggestion-secondary-code--best': secondaryCode.isBestSuggestion,
              'op-suggestion-secondary-code--inactive': secondaryCode.isCandidate === false,
            })}
            disabled={secondaryCode.isCandidate === false}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect?.(suggestion, secondaryCode.code);
            }}
          >
            {secondaryCode.code}
          </button>
        ))}
      </div>
    </div>
  );
};
