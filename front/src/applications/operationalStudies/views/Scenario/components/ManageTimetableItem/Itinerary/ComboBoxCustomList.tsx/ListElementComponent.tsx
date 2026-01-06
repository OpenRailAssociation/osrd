import './ListElementComponent.scss';

import cx from 'classnames';

export type OpCh = {
  code: string;
  opId?: string;
  isCandidate?: boolean;
  isBestSuggestion?: boolean;
};

export type OperationalPointSuggestion = {
  id: string;
  trigram: string;
  name: string;
  chList: OpCh[];
};

export type ListElementComponentProps = {
  suggestion: OperationalPointSuggestion;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  onPickCh?: (code: string) => void;
};

export const ListElementComponent = ({
  suggestion,
  isActive,
  isSelected,
  onPickCh,
}: ListElementComponentProps) => (
  <div
    className={cx('op-suggestion', {
      'op-suggestion--active': isActive,
      'op-suggestion--selected': isSelected,
    })}
  >
    <span className="op-suggestion-trigram">{suggestion.trigram}</span>
    <span className="op-suggestion-name">{suggestion.name}</span>

    <div className="op-suggestion-ch-list">
      {suggestion.chList.map((ch) => (
        <button
          key={ch.code}
          type="button"
          className={cx('op-suggestion-secondary-code', {
            'op-suggestion-secondary-code--best': ch.isBestSuggestion,
            'op-suggestion-secondary-code--inactive': ch.isCandidate === false,
          })}
          disabled={ch.isCandidate === false}
          onClick={() => {
            onPickCh?.(ch.code);
          }}
        >
          {ch.code}
        </button>
      ))}
    </div>
  </div>
);
