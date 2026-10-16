import { useRef, useState } from 'react';

import cx from 'classnames';

import CellPlaceholder from './CellPlaceholder';

type DistanceCellProps = {
  distanceValue: number | undefined;
  onCommit?: (value: number | null) => void;
  onEnterKeyDown?: () => void;
  onTabKeyDown?: (direction: 'forward' | 'backward') => boolean;
  'data-testid'?: string;
};

const formatValue = (value: number | undefined): string | undefined =>
  value !== undefined ? String(value).slice(0, 5) : undefined;

const DistanceCell = ({
  distanceValue,
  onCommit,
  onEnterKeyDown,
  onTabKeyDown,
  'data-testid': testId,
}: DistanceCellProps) => {
  const [draft, setDraft] = useState<string | undefined>(formatValue(distanceValue));
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [caretPosition, setCaretPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const syncCaret = (e: React.SyntheticEvent<HTMLInputElement>) => {
    setCaretPosition(e.currentTarget.selectionStart ?? 0);
  };

  const commit = () => {
    if (onCommit) {
      const trimmed = (draft ?? '').trim();
      if (trimmed === '') {
        if (distanceValue !== null) onCommit(null);
      } else {
        const parsed = Number(trimmed);
        if (!Number.isNaN(parsed) && parsed !== distanceValue) {
          onCommit(parsed);
        }
      }
    }
    setIsEditing(false);
  };

  const handleEscape = () => {
    setDraft(formatValue(distanceValue));
    setIsEditing(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    syncCaret(e);
    if (e.key === 'Enter') {
      commit();
      onEnterKeyDown?.();
      setIsEditing(false);
    } else if (e.key === 'Tab') {
      const handled = onTabKeyDown?.(e.shiftKey ? 'backward' : 'forward');
      if (handled) {
        e.preventDefault();
        commit();
        setIsEditing(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleEscape();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="distance-cell"
      data-testid={testId}
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        value={draft ?? ''}
        className="distance-cell__input"
        onFocus={() => {
          setDraft(formatValue(distanceValue));
          setIsEditing(true);
        }}
        onBlur={commit}
        onChange={(e) => setDraft(e.currentTarget.value.slice(0, 5))}
        onKeyDown={handleKeyDown}
        onKeyUp={syncCaret}
        onSelect={syncCaret}
      />
      {isEditing || (draft !== undefined && draft !== '') ? (
        <div
          className={cx('distance-cell__display', { 'distance-cell__display--saved': !isEditing })}
          aria-hidden="true"
        >
          <span className={cx('value', { 'value-editing': isEditing })}>
            {isEditing && draft !== undefined ? (
              <>
                {draft.slice(0, caretPosition)}
                <span className="custom-caret" />
                {draft.slice(caretPosition)}
              </>
            ) : (
              draft
            )}
          </span>
          <span className="unit-kilometer">km</span>
        </div>
      ) : (
        <CellPlaceholder onClick={function (): void {}} />
      )}
    </div>
  );
};

export default DistanceCell;
