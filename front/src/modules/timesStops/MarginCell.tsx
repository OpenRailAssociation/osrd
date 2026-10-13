import { useEffect, useRef, useState } from 'react';

import cx from 'classnames';

import CellPlaceholder from './CellPlaceholder';
import { MarginUnit } from './consts';
import type { MarginUnitType, MarginValue } from './types';

const PARTIAL_DECIMAL_REGEX = /^-?\d*[.,]?\d*$/;

const isSameMarginValue = (current: MarginValue | null, next: MarginValue | null): boolean => {
  if (!current && !next) return true;
  if (!current || !next) return false;
  return current.value === next.value && current.unit === next.unit;
};

const getMarginValueFromRaw = (raw: string | null, unit: MarginUnitType): MarginValue | null => {
  if (!raw) return null;
  const normalized = raw.replace(',', '.').replace(/\.$/, '');
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || normalized === '' || normalized === '-') return null;
  return { value: parsed, unit };
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
      data-testid="margin-unit-btn-percent"
      onClick={() => onChange(MarginUnit.percent)}
    >
      %
    </button>
    <button
      className={cx('unit', {
        'unit-active': value === MarginUnit.minPer100km,
      })}
      data-testid="margin-unit-btn-min-per-100km"
      onClick={() => onChange(MarginUnit.minPer100km)}
    >
      min/
      <br />
      100km
    </button>
  </div>
);

const MarginCellEditable = ({
  initialValue,
  isInherited = false,
  isFirstRow = false,
  onCommit,
  'data-testid': dataTestId,
}: {
  initialValue: MarginValue | null;
  isInherited: boolean;
  isFirstRow: boolean;
  onCommit?: (value: MarginValue | null) => void;
  'data-testid'?: string;
}) => {
  const [unit, setUnit] = useState<MarginUnitType>(initialValue?.unit ?? MarginUnit.percent);
  const [raw, setRaw] = useState<string | null>(initialValue?.value?.toString() ?? null);
  const [isEditing, setIsEditing] = useState(false);
  const displayValue = getMarginValueFromRaw(raw, unit);

  const inputRef = useRef<HTMLInputElement>(null);
  const skipCommitOnBlurRef = useRef(false);
  const isEmpty: boolean = raw === null;

  useEffect(() => {
    setUnit(initialValue?.unit ?? MarginUnit.percent);
    setRaw(initialValue?.value?.toString() ?? null);
    setIsEditing(false);
  }, [initialValue?.value, initialValue?.unit, isInherited]); // TODO : Remove this when depreciating input table

  const commit = () => {
    if (isInherited && !displayValue) {
      setRaw(String(initialValue?.value ?? ''));
      return;
    }
    if (isFirstRow && !displayValue) {
      onCommit?.({ value: 0, unit: MarginUnit.percent });
      setRaw('0');
      return;
    }
    if (isSameMarginValue(displayValue, initialValue) && !isInherited) return;

    onCommit?.(displayValue ?? null);
    setRaw(String(displayValue?.value ?? ''));
  };

  const startEditing = () => {
    if (!raw) {
      setRaw('');
    }
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  if (!isEditing) {
    return (
      <span
        className={cx('margin-cell display', {
          'hover-switch': !!raw && isInherited,
          inherited: isInherited,
        })}
        data-testid={dataTestId}
        role="button"
        onClick={!isInherited ? () => startEditing() : undefined}
        tabIndex={0}
      >
        {displayValue && <MarginDisplayLabel margin={displayValue} />}
        {isInherited && <CellPlaceholder onClick={startEditing} />}
      </span>
    );
  }

  return (
    <div className="margin-cell edit" data-testid={dataTestId}>
      {isEmpty && <CellPlaceholder onClick={() => inputRef.current?.focus()} />}
      <input
        type="text"
        inputMode="numeric"
        ref={inputRef}
        className="input"
        data-testid="margin-cell-input"
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
            commit();
            setIsEditing(false);
          }
          if (e.key === 'Escape') {
            skipCommitOnBlurRef.current = true;
            setUnit(initialValue?.unit ?? MarginUnit.percent);
            setRaw(initialValue?.value?.toString() ?? null);
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
            commit();
            setIsEditing(false);
          }
        }}
      />
      <UnitToggle
        value={unit}
        onChange={(u) => {
          setUnit(u);
          inputRef.current?.focus();
        }}
      />
    </div>
  );
};

const MarginCellReadOnly = ({
  showPolarity = false,
  marginValue,
  'data-testid': dataTestId,
}: {
  showPolarity?: boolean;
  marginValue: MarginValue | null;
  'data-testid'?: string;
}) => {
  if (!marginValue) return;
  const marginInSeconds = marginValue.value ?? 0;
  const isZero = marginInSeconds === 0;
  const polarity = marginInSeconds >= 0 ? '+' : '-';
  const abs = Math.abs(marginInSeconds);
  const minutes = String(Math.floor(abs / 60)).padStart(2, '0');
  const seconds = String(Math.floor(abs % 60)).padStart(2, '0');

  return (
    <div className="mono margin-cell" data-testid={dataTestId}>
      {showPolarity && <span>{!isZero && polarity}</span>}
      <span>{minutes}</span>
      <span className="unit-letter">m</span>
      <span>{seconds}</span>
      <span className="unit-letter">s</span>
    </div>
  );
};

const MarginCell = ({
  marginValue,
  editable = false,
  showPolarity = false,
  isInherited = false,
  isFirstRow = false,
  onCommit,
  'data-testid': dataTestId,
}: {
  marginValue: MarginValue | null;
  editable?: boolean;
  showPolarity?: boolean;
  isInherited?: boolean;
  isFirstRow?: boolean;
  onCommit?: (value: MarginValue | null) => void;
  'data-testid'?: string;
}) =>
  editable ? (
    <MarginCellEditable
      initialValue={marginValue}
      isInherited={isInherited}
      isFirstRow={isFirstRow}
      onCommit={onCommit}
      data-testid={dataTestId}
    />
  ) : (
    <MarginCellReadOnly
      showPolarity={showPolarity}
      marginValue={marginValue}
      data-testid={dataTestId}
    />
  );
export default MarginCell;
