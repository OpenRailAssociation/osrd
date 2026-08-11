/* eslint-disable jsx-a11y/no-noninteractive-tabindex */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import {
  useReducer,
  useRef,
  useLayoutEffect,
  useEffect,
  useImperativeHandle,
  type Dispatch,
} from 'react';

import type { CellContext } from '@tanstack/react-table';

import { Duration } from 'utils/duration';

import CellPlaceholder from './CellPlaceholder';
import ClearButton from './ClearButton';
import DurationPropagationMenu from './DurationPropagationMenu';
import type { StopPropagationMode, TimesStopsRowNew } from './types';

type ActiveUnit = 'h' | 'm' | 's';

const UNITS: ActiveUnit[] = ['h', 'm', 's'];

const clamp = (unit: ActiveUnit, value: string) => {
  const n = Number(value);
  if (unit === 'm' || unit === 's') return Math.min(n, 59).toString().padStart(2, '0');
  return value;
};

const secondsToUnits = (seconds: number): Record<ActiveUnit, string> => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return {
    h: String(h).padStart(2, '0'),
    m: String(m).padStart(2, '0'),
    s: String(s).padStart(2, '0'),
  };
};

const unitsToSeconds = (u: Record<ActiveUnit, string>) =>
  Number(u.h) * 3600 + Number(u.m) * 60 + Number(u.s);

const getNextUnit = (u: ActiveUnit) => UNITS[Math.min(UNITS.length - 1, UNITS.indexOf(u) + 1)];
const getPrevUnit = (u: ActiveUnit) => UNITS[Math.max(0, UNITS.indexOf(u) - 1)];

/** Two-space sentinel used to mark a unit as cleared (empty) by the user. */
const CLEARED_VALUE = '  ';
const isCleared = (value: string) => value === CLEARED_VALUE;

/**
 * In edit mode, when a unit has only 1 digit left and the user backspaces,
 * pull the value from the unit to the left (h→m or m→s) and clear that left unit.
 */
const clearAndCascadeUp = (
  units: Record<ActiveUnit, string>,
  activeUnit: ActiveUnit
): Record<ActiveUnit, string> => {
  const prevUnit = getPrevUnit(activeUnit);
  const prevValue = units[prevUnit];
  if (prevUnit === activeUnit || isCleared(prevValue)) {
    return { ...units, [activeUnit]: CLEARED_VALUE };
  }
  return {
    ...units,
    [activeUnit]: prevValue,
    [prevUnit]: CLEARED_VALUE,
  };
};

/**
 * Backspace when all digits are selected (initial state): shifts all values one slot to the right
 * up to activeUnit, clearing the leftmost slot. E.g. activeUnit='s': h→CLEARED, m←h, s←m.
 */
const cascadeAll = (
  units: Record<ActiveUnit, string>,
  activeUnit: ActiveUnit
): Record<ActiveUnit, string> => {
  const newUnits = { ...units };
  const upTo = UNITS.indexOf(activeUnit);
  for (let i = upTo; i > 0; i--) {
    newUnits[UNITS[i]] = units[UNITS[i - 1]];
  }
  newUnits[UNITS[0]] = CLEARED_VALUE;
  return newUnits;
};

type ApplyResult = { units: Record<ActiveUnit, string>; activeUnit: ActiveUnit };

/**
 * Applies one backspace in digit-edit mode (allDigitsSelected=false) starting at the given unit.
 * If the unit is already CLEARED, navigates right and applies there (navigate+delete in one press).
 * If the result is CLEARED and a unit to the right exists, auto-advances activeUnit.
 */
const applyDigitBackspace = (
  units: Record<ActiveUnit, string>,
  activeUnit: ActiveUnit
): ApplyResult => {
  const value = units[activeUnit];

  if (isCleared(value)) {
    const next = getNextUnit(activeUnit);
    if (next === activeUnit) return { units, activeUnit }; // rightmost, nothing to do
    return applyDigitBackspace(units, next);
  }

  if (value[0] !== CLEARED_VALUE[0]) {
    // 2 digits (XY): remove last → ' X'
    return { units: { ...units, [activeUnit]: CLEARED_VALUE[0] + value[0] }, activeUnit };
  }

  // 1 digit (' X'): cascade from previous unit
  const newUnits = clearAndCascadeUp(units, activeUnit);
  if (isCleared(newUnits[activeUnit])) {
    // Unit got cleared (no left neighbour to pull from): auto-advance right
    const next = getNextUnit(activeUnit);
    if (next !== activeUnit) return { units: newUnits, activeUnit: next };
  }
  return { units: newUnits, activeUnit };
};

/**
 * In creation mode, digits fill m then s (≤4 digits), then redistribute h/m/s (5–6 digits),
 * so that typing "013700" produces 01h37m00s. Derives display units from the digit string.
 */
const parseBuffer = (
  digits: string
): { units: Record<ActiveUnit, string>; activeUnit: ActiveUnit } => {
  const processChunk = (chunk: string, unit: ActiveUnit) => {
    if (!chunk) return CLEARED_VALUE;
    const n = Number(chunk);
    const clamped = unit !== 'h' ? Math.min(n, 59) : n;
    return clamped !== n
      ? clamped.toString().padStart(2, '0')
      : chunk.length === 1
        ? CLEARED_VALUE[0] + chunk
        : chunk.padStart(2, '0');
  };

  if (digits.length === 0)
    return {
      units: { h: CLEARED_VALUE, m: CLEARED_VALUE, s: CLEARED_VALUE },
      activeUnit: 'm',
    };
  if (digits.length <= 4) {
    return {
      units: {
        h: CLEARED_VALUE,
        m: processChunk(digits.slice(0, 2), 'm'),
        s: processChunk(digits.slice(2, 4), 's'),
      },
      activeUnit: digits.length <= 2 ? 'm' : 's',
    };
  }
  return {
    units: {
      h: processChunk(digits.slice(0, 2), 'h'),
      m: processChunk(digits.slice(2, 4), 'm'),
      s: processChunk(digits.slice(4, 6), 's'),
    },
    activeUnit: 's',
  };
};

type DurationState = {
  isEditing: boolean;
  allDigitsSelected: boolean;
  isCreationMode: boolean;
  activeUnit: ActiveUnit;
  units: Record<ActiveUnit, string>;
  creationDigits: string; // buffer for creation mode : digits shift h←m←s as you type
  editedDigitCount: number; // count for edition mode: shift to next digit as you type
};

type DurationAction =
  | {
      type: 'START_EDITING';
      payload: { seconds: number; unit: ActiveUnit; isCreationMode: boolean };
    }
  | { type: 'STOP_EDITING' }
  | { type: 'WRITE_DIGIT'; payload: string }
  | { type: 'BACKSPACE' }
  | { type: 'NAVIGATE'; payload: 'left' | 'right' }
  | { type: 'SET_ACTIVE_UNIT'; payload: ActiveUnit }
  | { type: 'EXTERNAL_VALUE_CHANGED'; payload: number }
  | { type: 'CANCEL_EDITING'; payload: Duration | null };

const initialState: DurationState = {
  isEditing: false,
  allDigitsSelected: true,
  isCreationMode: false,
  activeUnit: 'm',
  units: secondsToUnits(0),
  creationDigits: '',
  editedDigitCount: 0,
};

const initialDurationState = (controlledValue: Duration | null): DurationState => ({
  ...initialState,
  units: controlledValue
    ? secondsToUnits(Math.round(controlledValue.total('second')))
    : secondsToUnits(0),
});

const durationReducer = (state: DurationState, action: DurationAction): DurationState => {
  switch (action.type) {
    case 'START_EDITING': {
      const { seconds, unit, isCreationMode } = action.payload;
      const clearedUnits: Record<ActiveUnit, string> = {
        h: CLEARED_VALUE,
        m: CLEARED_VALUE,
        s: CLEARED_VALUE,
      };
      return {
        ...state,
        units: isCreationMode ? clearedUnits : secondsToUnits(seconds),
        activeUnit: unit,
        isEditing: true,
        allDigitsSelected: true,
        isCreationMode,
        creationDigits: '',
        editedDigitCount: 0,
      };
    }
    case 'STOP_EDITING': {
      const seconds = unitsToSeconds(state.units);
      return {
        ...state,
        units: secondsToUnits(seconds),
        isEditing: false,
      };
    }

    case 'WRITE_DIGIT': {
      const digit = action.payload;

      if (state.isCreationMode) {
        const nextDigits = state.creationDigits + digit;
        if (nextDigits.length > 6) return state;
        const { units, activeUnit } = parseBuffer(nextDigits);
        return {
          ...state,
          allDigitsSelected: false,
          creationDigits: nextDigits,
          units,
          activeUnit,
        };
      }

      const value = state.units[state.activeUnit];
      // Replacement mode: initial state, cleared unit, or untouched '00' unit
      const nextValue =
        state.allDigitsSelected || value === '00' || isCleared(value)
          ? CLEARED_VALUE[0] + digit
          : clamp(state.activeUnit, value[1] + digit);

      let editedDigitCount = ++state.editedDigitCount;
      let nextUnit = state.activeUnit;
      if (state.editedDigitCount > 1) {
        nextUnit = getNextUnit(state.activeUnit);

        editedDigitCount = 0;
      }

      return {
        ...state,
        allDigitsSelected: false,
        editedDigitCount,
        activeUnit: nextUnit,
        units: { ...state.units, [state.activeUnit]: nextValue },
      };
    }

    case 'BACKSPACE': {
      if (state.isCreationMode && state.creationDigits.length > 0) {
        const nextDigits = state.creationDigits.slice(0, -1);
        const { units, activeUnit } = parseBuffer(nextDigits);
        return {
          ...state,
          allDigitsSelected: false,
          creationDigits: nextDigits,
          units,
          activeUnit,
        };
      }

      if (state.allDigitsSelected) {
        return {
          ...state,
          isCreationMode: false,
          allDigitsSelected: false,
          editedDigitCount: 0,
          units: cascadeAll(state.units, state.activeUnit),
        };
      }

      const { units, activeUnit } = applyDigitBackspace(state.units, state.activeUnit);
      return {
        ...state,
        isCreationMode: false,
        allDigitsSelected: false,
        units,
        activeUnit,
        editedDigitCount: 0,
      };
    }

    case 'NAVIGATE': {
      const direction = action.payload;
      return {
        ...state,
        isCreationMode: false,
        editedDigitCount: 0,
        activeUnit:
          direction === 'left' ? getPrevUnit(state.activeUnit) : getNextUnit(state.activeUnit),
      };
    }

    case 'SET_ACTIVE_UNIT':
      return {
        ...state,
        isCreationMode: false,
        activeUnit: action.payload,
        editedDigitCount: 0,
      };

    case 'EXTERNAL_VALUE_CHANGED':
      // Only sync if not currently editing to avoid overwriting user input
      if (state.isEditing) return state;
      return { ...state, units: secondsToUnits(action.payload) };

    case 'CANCEL_EDITING':
      return initialDurationState(action.payload);

    default:
      return state;
  }
};

type UnitDisplayProps = {
  unit: ActiveUnit;
  state: DurationState;
  dispatch: Dispatch<DurationAction>;
  startEditing: (unit: ActiveUnit) => void;
  isEdited: boolean;
};

const UnitDisplay = ({ unit, state, dispatch, startEditing, isEdited }: UnitDisplayProps) => {
  const u = state.units[unit];
  const focused = state.isEditing && state.activeUnit === unit;
  const baseClass = 'duration-cell-digit';
  const savedClass = !state.isEditing && isEdited ? `${baseClass}-saved` : '';
  const focusClass = focused
    ? !state.allDigitsSelected
      ? 'duration-cell-digit-focused-editing'
      : 'duration-cell-digit-focused-initial'
    : '';
  const letterClass =
    !state.isEditing && isEdited ? 'duration-cell-letter-saved' : 'duration-cell-letter';

  return (
    <span
      role="none"
      key={unit}
      className={`${baseClass} ${savedClass} ${focusClass}`}
      onClick={(e) => {
        e.stopPropagation();
        if (state.isEditing) {
          dispatch({ type: 'SET_ACTIVE_UNIT', payload: unit });
        } else {
          startEditing(unit);
        }
      }}
    >
      <span className="duration-cell-digits-value">
        {focused && !state.allDigitsSelected && !isCleared(u) && (
          <span className="duration-cell-caret" style={{ left: '100%' }} />
        )}
        {isCleared(u) ? (
          <span className="duration-cell-cleared">--</span>
        ) : (
          <>
            <span>{u[0] === CLEARED_VALUE[0] ? '-' : u[0]}</span>
            <span>{u[1]}</span>
          </>
        )}
      </span>
      {unit && <span className={letterClass}>{unit}</span>}
    </span>
  );
};

export type DurationCellHandle = {
  focus: () => void;
};

type DurationCellProps = CellContext<TimesStopsRowNew, Duration | null> &
  Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> & {
    prefillValue?: Duration | null;
    onEnterKeyDown?: () => void;
    onTabKeyDown?: (direction: 'forward' | 'backward') => boolean;
    onCommit?: (seconds: number | null, propagationMode: StopPropagationMode) => void;
    disabled?: boolean;
    clearButtonTitle?: string;
    disableClear?: boolean;
    ref?: React.Ref<DurationCellHandle>;
  };

const DurationCell = ({
  prefillValue,
  disabled,
  clearButtonTitle,
  ref,
  onEnterKeyDown,
  onTabKeyDown,
  disableClear,
  ...props
}: DurationCellProps) => {
  const { onCommit, getValue, row, table } = props || {};
  const controlledValue = getValue();
  const [state, dispatch] = useReducer(durationReducer, controlledValue, initialDurationState);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseDownRef = useRef(false);
  // Guards onBlur against double-committing after an explicit blur() (Enter/Escape/menu-select).
  const blurHandledRef = useRef(false);
  const isFirstRow = row.index === 0;
  const isLastRow = row.index === table.getRowCount() - 1;
  const allDigitsCleared = Object.values(state.units).every((u) => isCleared(u));

  useImperativeHandle(
    ref,
    () => ({
      focus: () => containerRef.current?.focus(),
    }),
    []
  );

  // Sync internal state with external value when it changes (and not editing)
  useEffect(() => {
    const seconds = controlledValue?.total('second') ?? 0;
    dispatch({ type: 'EXTERNAL_VALUE_CHANGED', payload: Math.round(seconds) });
  }, [controlledValue]);

  useLayoutEffect(() => {
    if (state.isEditing) containerRef.current?.focus();
  }, [state.isEditing]);

  const startEditing = (unit: ActiveUnit) => {
    if (disabled) return;
    const initialValue = controlledValue ?? prefillValue ?? Duration.zero;
    const isCreationMode = controlledValue === null && prefillValue === null;
    const seconds = Math.round(initialValue.total('second'));
    dispatch({
      type: 'START_EDITING',
      payload: { seconds, unit: isCreationMode ? 'm' : unit, isCreationMode },
    });
  };

  const handleClear = () => {
    if (controlledValue !== null) onCommit?.(null, 'atThisWaypoint');
    dispatch({ type: 'STOP_EDITING' });
  };

  const commit = (propagationMode: StopPropagationMode = 'atThisWaypoint') => {
    if (allDigitsCleared) {
      if (controlledValue !== null) onCommit?.(null, propagationMode);
    } else {
      const newSeconds = unitsToSeconds(state.units);
      const initialSeconds =
        controlledValue !== null ? Math.round(controlledValue.total('second')) : null;
      if (newSeconds !== initialSeconds) onCommit?.(newSeconds, propagationMode);
    }
    dispatch({ type: 'STOP_EDITING' });
  };

  const handleSelectPropagationMode = (mode: StopPropagationMode) => {
    blurHandledRef.current = true;
    commit(mode);
    containerRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!state.isEditing) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        blurHandledRef.current = true;
        commit();
        onEnterKeyDown?.();
        containerRef.current?.blur();
        break;
      case 'Escape':
        e.preventDefault();
        blurHandledRef.current = true;
        dispatch({ type: 'CANCEL_EDITING', payload: controlledValue });
        containerRef.current?.blur();
        break;
      case 'Tab':
        if (onTabKeyDown?.(e.shiftKey ? 'backward' : 'forward')) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        dispatch({ type: 'NAVIGATE', payload: 'left' });
        break;
      case 'ArrowRight':
        e.preventDefault();
        dispatch({ type: 'NAVIGATE', payload: 'right' });
        break;
      case 'Backspace':
        e.preventDefault();
        dispatch({ type: 'BACKSPACE' });
        break;
      default:
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          dispatch({ type: 'WRITE_DIGIT', payload: e.key });
        }
    }
  };

  const isEdited = controlledValue !== null || Object.values(state.units).some((u) => u !== '00');
  const showPlaceholder = !state.isEditing && controlledValue === null;
  const shouldShowPropagationMenu = state.isEditing && !state.allDigitsSelected;
  const editedDuration = allDigitsCleared
    ? null
    : new Duration({ seconds: unitsToSeconds(state.units) });

  const handleMouseDown = () => {
    mouseDownRef.current = true;
  };

  const handleMouseUp = () => {
    mouseDownRef.current = false;
  };

  return (
    <>
      <div
        ref={containerRef}
        tabIndex={0}
        className="duration-cell"
        data-testid="duration-cell"
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (!mouseDownRef.current && !state.isEditing) startEditing('m');
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onBlur={() => {
          mouseDownRef.current = false;
          if (blurHandledRef.current) {
            blurHandledRef.current = false;
            return;
          }
          if (state.isEditing) commit();
        }}
        onClick={() => !state.isEditing && startEditing('m')}
      >
        {showPlaceholder ? (
          <CellPlaceholder onClick={() => {}} />
        ) : (
          <>
            {UNITS.map((unit) => (
              <UnitDisplay
                key={unit}
                unit={unit}
                state={state}
                dispatch={dispatch}
                startEditing={startEditing}
                isEdited={isEdited}
              />
            ))}
          </>
        )}
        <DurationPropagationMenu
          isOpen={shouldShowPropagationMenu}
          anchorRef={{ current: containerRef.current?.closest('td') ?? null }}
          oldValue={controlledValue}
          newValue={editedDuration}
          onSelectMode={handleSelectPropagationMode}
          disableFromDeparture={isFirstRow}
          disableToDestination={isLastRow}
        />
      </div>
      <ClearButton
        isVisible={state.isEditing && !disableClear}
        title={clearButtonTitle}
        containerRef={containerRef}
        onClear={handleClear}
      />
    </>
  );
};

export default DurationCell;
