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
  onSelect?: (op: OperationalPointSuggestion, secondaryCode?: string) => void;
};

export const ListElementComponent = ({
  suggestion,
  isActive,
  isSelected,
  onSelect,
}: ListElementComponentProps) => (
  <div
    className={cx('op-suggestion', {
      'op-suggestion--active': isActive,
      'op-suggestion--selected': isSelected,
    })}
    role="button"
    tabIndex={0}
    onMouseDown={(e) => {
      e.preventDefault();
      e.stopPropagation();
      const defaultCh = suggestion.chList?.[0]?.code;
      onSelect?.(suggestion, defaultCh);
    }}
  >
    <span className="op-suggestion-trigram">{suggestion.trigram}</span>
    <span className="op-suggestion-name">{suggestion.name}</span>

    <div className="op-suggestion-secondary-code-list">
      {suggestion.chList.map((secondaryCode) => (
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
