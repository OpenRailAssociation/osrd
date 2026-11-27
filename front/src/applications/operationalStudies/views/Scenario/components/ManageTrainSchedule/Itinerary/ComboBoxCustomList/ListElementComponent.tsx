import { useState } from 'react';

import { InfrastructureInvalid, NoEntry } from '@osrd-project/ui-icons';
import cx from 'classnames';

import './ListElementComponent.scss';

export type OpSecondaryCode = {
  code: string | null;
  name: string | null;
  isCandidate?: boolean;
  isBestSuggestion?: boolean;
  isPending?: boolean;
};

export type OperationalPointSuggestion = {
  id: string;
  mainCode: string;
  uic?: number | null;
  name: string;
  countryCode: string;
  secondaryCodeList: OpSecondaryCode[];
  source: 'infra' | 'pending' | 'macroNode';
};

export type ListElementComponentProps = {
  suggestion: OperationalPointSuggestion;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  onSelect?: (op: OperationalPointSuggestion, secondaryCode?: string | null) => void;
};

export const ListElementComponent = ({
  suggestion,
  isActive,
  isSelected,
  onSelect,
}: ListElementComponentProps) => {
  const [isNameHovered, setIsNameHovered] = useState(false);
  const isCustom = suggestion.source === 'pending';

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
      {isCustom && (
        <span className="op-suggestion-custom-icon">
          <InfrastructureInvalid size="lg" />
        </span>
      )}

      <span
        className={cx('op-suggestion-main-code', {
          'op-suggestion-main-code--custom': isCustom,
        })}
      >
        {suggestion.mainCode}
      </span>

      <span
        className="op-suggestion-name"
        onMouseEnter={() => setIsNameHovered(true)}
        onMouseLeave={() => setIsNameHovered(false)}
      >
        {suggestion.name}
      </span>

      <div className="op-suggestion-secondary-code-list">
        {suggestion.secondaryCodeList.map((secondaryCode, index) => (
          <button
            key={secondaryCode.code ?? `no_secondary_code_${index}`}
            type="button"
            className={cx('op-suggestion-secondary-code', {
              'op-suggestion-secondary-code--best': secondaryCode.isBestSuggestion,
              'op-suggestion-secondary-code--pending': secondaryCode.isPending,
              'op-suggestion-secondary-code--inactive': secondaryCode.isCandidate === false,
            })}
            disabled={secondaryCode.isCandidate === false}
            title={secondaryCode.name ?? undefined}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect?.(suggestion, secondaryCode.code);
            }}
          >
            {secondaryCode.code ?? <NoEntry />}
          </button>
        ))}
      </div>
    </div>
  );
};
