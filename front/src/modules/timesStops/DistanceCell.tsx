import { useEffect, useImperativeHandle, useRef, useState } from 'react';

import cx from 'classnames';

import CellPlaceholder from './CellPlaceholder';

type DistanceCellHandle = {
  focus: () => void;
};

type DistanceCellProps = {
  ref?: React.Ref<DistanceCellHandle>;
  distanceValue: number | undefined;
  onCommit?: (value: number | null) => void;
  onEnterKeyDown?: () => void;
  onTabKeyDown?: (direction: 'forward' | 'backward') => boolean;
  'data-testid'?: string;
};

const formatValue = (value: number | undefined): string | undefined =>
  value !== undefined ? String(value) : undefined;

const DistanceCell = ({
  ref,
  distanceValue,
  onCommit,
  onEnterKeyDown,
  onTabKeyDown,
  'data-testid': testId,
}: DistanceCellProps) => {
  const [draft, setDraft] = useState<string | undefined>(formatValue(distanceValue));
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  const normalizeInput = (input: string | undefined): string => {
    const trimmed = (input ?? '').trim();
    return trimmed.replaceAll(',', '.');
  };

  const commit = () => {
    if (onCommit) {
      const normalized = normalizeInput(draft);
      if (normalized === '') {
        if (distanceValue !== null && distanceValue !== undefined) onCommit(null);
      } else {
        const parsed = Number(normalized);
        if (!Number.isNaN(parsed) && parsed !== distanceValue) {
          onCommit(parsed);
          setDraft(String(parsed));
        } else {
          setDraft(String(distanceValue));
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

  const editAndFocus = (event?: React.MouseEvent | React.FocusEvent) => {
    event?.preventDefault();
    setIsEditing(true);
    inputRef.current?.focus();
  };

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        editAndFocus();
      },
    }),
    []
  );

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  return (
    <div
      className={cx('distance-cell', 'editable', {
        editing: isEditing,
        empty: distanceValue === undefined,
      })}
      data-testid={testId}
      onClick={editAndFocus}
      onFocus={editAndFocus}
      ref={cellRef}
      role="button"
      tabIndex={isEditing ? -1 : 0}
    >
      {isEditing ? (
        <>
          <input
            type="text"
            inputMode="numeric"
            ref={inputRef}
            className="input"
            data-testid="distance-cell-input"
            value={draft ?? ''}
            onBlur={(event) => {
              if (
                !event.relatedTarget ||
                (event.relatedTarget !== cellRef.current &&
                  !cellRef.current?.contains(event.relatedTarget))
              ) {
                commit();
              }
            }}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="unit">km</span>
        </>
      ) : distanceValue !== undefined ? (
        <>
          <span className="value">{formatValue(distanceValue)}</span>
          <span className="unit">km</span>
        </>
      ) : (
        <CellPlaceholder />
      )}
    </div>
  );
};

export default DistanceCell;
