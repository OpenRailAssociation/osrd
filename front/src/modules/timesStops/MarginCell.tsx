import { useEffect, useRef, useState } from 'react';

import type { CellContext } from '@tanstack/react-table';
import cx from 'classnames';

import CellPlaceholder from './CellPlaceholder';
import { MarginUnit } from './consts';
import type { MarginUnitType, MarginValue, TimesStopsRowNew } from './types';

const PARTIAL_DECIMAL_REGEX = /^-?\d*[.,]?\d*$/;

const isSameMarginValue = (current: MarginValue | undefined, next: MarginValue | null): boolean => {
  if (!current && !next) return true;
  if (!current || !next) return false;
  return current.value === next.value && current.unit === next.unit;
};

const getMarginValueFromRaw = (
  raw: string | null,
  unit: MarginUnitType
): MarginValue | undefined => {
  if (raw == null || raw === '') return undefined;
  const normalized = raw.replace(',', '.').replace(/\.$/, '');
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || normalized === '' || normalized === '-') return undefined;
  return { value: parsed, unit };
};

const getInheritedRequestedMargin = (allRows: TimesStopsRowNew[], rowIndex: number) => {
  for (let index = rowIndex - 1; index >= 0; index -= 1) {
    const candidate = allRows[index];
    if (candidate?.isTheoreticalMarginBoundary && candidate.requestedTheoreticalMargin) {
      return candidate.requestedTheoreticalMargin;
    }
  }

  return undefined;
};

const MarginDisplayLabel = ({ margin }: { margin: MarginValue }) => {
  if (margin.unit === MarginUnit.minPer100km) {
    return (
      <span className="label compact">
        <span className="value">{margin.value}</span>
        <span className="unit">
          <span>min/</span>
          <span>100km</span>
        </span>
      </span>
    );
  }

  if (margin.unit === MarginUnit.percent) {
    return (
      <span className="label">
        <span className="value">{margin.value}</span>
        <span className="unit">%</span>
      </span>
    );
  }

  return null;
};

const UnitToggle = ({
  value,
  onChange,
}: {
  value: MarginUnitType;
  onChange: (unit: MarginUnitType) => void;
}) => (
  <div className="unit-selection">
    <button
      className={cx('unit', { 'unit-active': value === MarginUnit.percent })}
      onClick={() => onChange(MarginUnit.percent)}
    >
      %
    </button>
    <button
      className={cx('unit', {
        'unit-active': value === MarginUnit.minPer100km,
      })}
      onClick={() => onChange(MarginUnit.minPer100km)}
    >
      min/
      <br />
      100km
    </button>
  </div>
);

const MarginCellEditable = ({
  getValue,
  row,
  table,
  isInherited = false,
  isScheduledOp = true,
  onCommit,
}: CellContext<TimesStopsRowNew, MarginValue | undefined> & {
  isInherited?: boolean;
  isScheduledOp?: boolean;
  onCommit?: (value: MarginValue | null) => void;
}) => {
  const ownValue = getValue();
  const resolvedValue =
    isInherited && isScheduledOp
      ? getInheritedRequestedMargin(table.options.meta?.allRows ?? [], row.index)
      : ownValue;
  const initial = isScheduledOp ? resolvedValue : undefined;
  const [unit, setUnit] = useState<MarginUnitType>(initial?.unit ?? MarginUnit.percent);
  const [raw, setRaw] = useState<string | null>(initial?.value?.toString() ?? null);
  const [isEditing, setIsEditing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const skipCommitOnBlurRef = useRef(false);
  const isEmpty: boolean = raw == null;
  const displayMargin = initial ?? getMarginValueFromRaw(raw, unit);

  useEffect(() => {
    setUnit(initial?.unit ?? MarginUnit.percent);
    setRaw(initial?.value?.toString() ?? null);
    setIsEditing(false);
  }, [initial?.value, initial?.unit, ownValue]); // TODO : Remove this when depreciating input table

  const commit = () => {
    if (!raw) {
      if (isSameMarginValue(ownValue, null) && !isInherited) {
        setRaw(ownValue?.value?.toString() ?? null);
        return;
      }
      onCommit?.(null);
      setRaw(null);
    } else {
      const normalized = raw.replace(',', '.').replace(/\.$/, '');
      const parsed = parseFloat(normalized);
      if (isNaN(parsed) || normalized === '' || normalized === '-') {
        onCommit?.(null);
        setRaw('');
      } else {
        const nextValue = { value: parsed, unit };
        if (isSameMarginValue(ownValue, nextValue) && !isInherited) {
          setRaw(String(parsed));
          return;
        }
        onCommit?.(nextValue);
        setRaw(String(parsed));
      }
    }
  };

  const startEditing = () => {
    if (raw == null) {
      setRaw('');
    }
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitAndClose = () => {
    commit();
    setIsEditing(false);
  };

  if (!isEditing) {
    if (!displayMargin)
      return (
        <button
          type="button"
          className={cx('margin-cell display', 'inherited', 'only-placeholder')}
          onClick={startEditing}
          aria-label="Edit margin"
        >
          <CellPlaceholder onClick={startEditing} />
        </button>
      );
    return (
      <button
        type="button"
        className={cx('margin-cell display', { inherited: isInherited })}
        onClick={startEditing}
        aria-label="Edit margin"
      >
        {isInherited ? (
          <>
            <span className="display-label">
              <MarginDisplayLabel margin={displayMargin} />
            </span>
            <span className="hover-placeholder">
              <CellPlaceholder onClick={startEditing} />
            </span>
          </>
        ) : (
          <MarginDisplayLabel margin={displayMargin} />
        )}
      </button>
    );
  }

  return (
    <div className="margin-cell edit">
      {isEmpty && <CellPlaceholder onClick={() => inputRef.current?.focus()} />}
      <input
        type="text"
        inputMode="numeric"
        ref={inputRef}
        className="input"
        value={raw ?? ''}
        style={{ pointerEvents: isEmpty ? 'none' : 'auto' }}
        onFocus={() => setIsEditing(true)}
        onChange={(e) => {
          const v = e.target.value;
          if ((PARTIAL_DECIMAL_REGEX.test(v) && v.length <= 4) || v === '') setRaw(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitAndClose();
          }
          if (e.key === 'Escape') {
            skipCommitOnBlurRef.current = true;
            setUnit(initial?.unit ?? MarginUnit.percent);
            setRaw(initial?.value?.toString() ?? null);
            setIsEditing(false);
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => {
          if (skipCommitOnBlurRef.current) {
            skipCommitOnBlurRef.current = false;
            setIsEditing(false);
            return;
          }
          if (!e.relatedTarget?.classList.contains('unit')) {
            commitAndClose();
          }
        }}
      />
      {isEditing && !isEmpty && (
        <UnitToggle
          value={unit}
          onChange={(u) => {
            setUnit(u);
            inputRef.current?.focus();
          }}
        />
      )}
    </div>
  );
};

const MarginCellReadOnly = ({
  showPolarity = false,
  ...props
}: CellContext<TimesStopsRowNew, MarginValue | undefined> & {
  showPolarity?: boolean;
}) => {
  const margin = props.getValue();
  if (!margin) return;
  const marginInSeconds = margin.value ?? 0;
  const isZero = marginInSeconds === 0;
  const polarity = marginInSeconds >= 0 ? '+' : '-';
  const abs = Math.abs(marginInSeconds);
  const minutes = String(Math.floor(abs / 60)).padStart(2, '0');
  const seconds = String(Math.floor(abs % 60)).padStart(2, '0');

  return (
    <div className="margin-cell">
      {showPolarity && <span>{!isZero && polarity}</span>}
      <span className="mono">{minutes}</span>
      <span className="unit-letter">m</span>
      <span className="mono">{seconds}</span>
      <span className="unit-letter">s</span>
    </div>
  );
};

const MarginCell = ({
  editable = false,
  showPolarity = false,
  isInherited = false,
  isScheduledOp = true,
  onCommit,
  ...props
}: CellContext<TimesStopsRowNew, MarginValue | undefined> & {
  editable?: boolean;
  showPolarity?: boolean;
  isInherited?: boolean;
  isScheduledOp?: boolean;
  onCommit?: (value: MarginValue | null) => void;
}) =>
  editable ? (
    <MarginCellEditable
      {...props}
      isInherited={isInherited}
      isScheduledOp={isScheduledOp}
      onCommit={onCommit}
    />
  ) : (
    <MarginCellReadOnly showPolarity={showPolarity} {...props} />
  );
export default MarginCell;
