import { useEffect, useRef, useState } from 'react';

import type { CellContext } from '@tanstack/react-table';
import cx from 'classnames';

import CellPlaceholder from './CellPlaceholder';
import { MarginUnit } from './consts';
import type { MarginUnitType, MarginValue, TimesStopsRowNew } from './types';

const PARTIAL_DECIMAL_REGEX = /^-?\d*[.,]?\d*$/;

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
      className={cx('unit', { 'unit-active': value === MarginUnit.minPer100km })}
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
  onCommit,
}: CellContext<TimesStopsRowNew, MarginValue | undefined> & {
  onCommit?: (value: MarginValue | null) => void;
}) => {
  const initial = getValue();
  const [unit, setUnit] = useState<MarginUnitType>(initial?.unit ?? MarginUnit.percent);
  const [raw, setRaw] = useState<string | null>(initial?.value?.toString() ?? null);

  const inputRef = useRef<HTMLInputElement>(null);
  const isEmpty: boolean = raw == null;

  useEffect(() => {
    setUnit(initial?.unit ?? MarginUnit.percent);
    setRaw(initial?.value?.toString() ?? null);
  }, [initial?.value, initial?.unit]); // TODO : Remove this when depreciating input table

  const commit = (overrideRaw: string | null = raw, overrideUnit: MarginUnitType = unit) => {
    if (!overrideRaw) {
      onCommit?.(null);
      setRaw(null);
    } else {
      const normalized = overrideRaw.replace(',', '.').replace(/\.$/, '');
      const parsed = parseFloat(normalized);
      if (isNaN(parsed) || normalized === '' || normalized === '-') {
        onCommit?.(null);
        setRaw('');
      } else {
        onCommit?.({ value: parsed, unit: overrideUnit });
        setRaw(String(parsed));
      }
    }
  };

  return (
    <div className="margin-cell">
      {isEmpty && (
        <CellPlaceholder
          onClick={() => {
            setRaw('');
            inputRef.current?.focus();
          }}
        />
      )}
      <input
        type="text"
        inputMode="numeric"
        ref={inputRef}
        className="input"
        value={raw ?? ''}
        style={{ pointerEvents: isEmpty ? 'none' : 'auto' }}
        onChange={(e) => {
          const v = e.target.value;
          if (PARTIAL_DECIMAL_REGEX.test(v) || v === '') setRaw(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setRaw(initial?.value?.toString() ?? '');
            e.currentTarget.blur();
          }
        }}
        onWheel={(e) => e.currentTarget.blur()}
        onBlur={(e) => {
          if (!e.relatedTarget?.classList.contains('unit')) {
            commit();
          }
        }}
      />
      {!isEmpty && (
        <UnitToggle
          value={unit}
          onChange={(u) => {
            setUnit(u);
            commit(raw, u);
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
  onCommit,
  ...props
}: CellContext<TimesStopsRowNew, MarginValue | undefined> & {
  editable?: boolean;
  showPolarity?: boolean;
  onCommit?: (value: MarginValue | null) => void;
}) =>
  editable ? (
    <MarginCellEditable {...props} onCommit={onCommit} />
  ) : (
    <MarginCellReadOnly showPolarity={showPolarity} {...props} />
  );
export default MarginCell;
