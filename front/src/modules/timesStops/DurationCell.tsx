/* eslint-disable jsx-a11y/no-noninteractive-tabindex */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import { useReducer, useRef, useEffect, type Dispatch } from 'react';

import type { CellContext } from '@tanstack/react-table';

import type { Duration } from 'utils/duration';

import CellPlaceholder from './CellPlaceholder';
import type { TimesStopsRowNew } from './types';

type ActiveUnit = 'h' | 'm' | 's';

type UnitState = {
  value: string;
  cursor: 0 | 1;
};

const UNITS: ActiveUnit[] = ['h', 'm', 's'];

const clamp = (unit: ActiveUnit, value: string) => {
  const n = Number(value);
  if (unit === 'm' || unit === 's') return Math.min(n, 59).toString().padStart(2, '0');
  return value;
};

const secondsToUnits = (seconds: number): Record<ActiveUnit, UnitState> => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return {
    h: { value: String(h).padStart(2, '0'), cursor: 0 },
    m: { value: String(m).padStart(2, '0'), cursor: 0 },
    s: { value: String(s).padStart(2, '0'), cursor: 0 },
  };
};

const parseUnitValue = (val: string) => {
  if (val.startsWith(' ')) {
    return Number(val) * 10;
  }
  return Number(val);
};

const unitsToSeconds = (u: Record<ActiveUnit, UnitState>) =>
  parseUnitValue(u.h.value) * 3600 + parseUnitValue(u.m.value) * 60 + parseUnitValue(u.s.value);

const emptyUnits = (): Record<ActiveUnit, UnitState> => ({
  h: { value: '00', cursor: 0 },
  m: { value: '00', cursor: 0 },
  s: { value: '00', cursor: 0 },
});

const getNextUnit = (u: ActiveUnit) => UNITS[Math.min(UNITS.length - 1, UNITS.indexOf(u) + 1)];
const getPrevUnit = (u: ActiveUnit) => UNITS[Math.max(0, UNITS.indexOf(u) - 1)];

const parseBuffer = (
  buffer: string
): { units: Record<ActiveUnit, UnitState>; activeUnit: ActiveUnit } => {
  let h = '00';
  let m = '00';
  let s = '00';
  let activeUnit: ActiveUnit = 'm';

  if (buffer.length === 0) {
    return {
      units: emptyUnits(),
      activeUnit: 'm',
    };
  }

  const processChunk = (chunk: string, unit: ActiveUnit) => {
    if (!chunk) return '00';

    const num = Number(chunk);
    let newVal = num;
    if ((unit === 'm' || unit === 's') && num > 59) newVal = 59;
    // For hours, we typically don't clamp to 59, but we can respect 2-digit max implicitly by slicing
    // or just let it be. Currently slicing limits to 2 chars max (<= 99).

    if (newVal !== num) {
      return newVal.toString().padStart(2, '0');
    }

    if (chunk.length === 1) return ' ' + chunk;
    return chunk.padStart(2, '0');
  };

  if (buffer.length <= 4) {
    m = processChunk(buffer.slice(0, 2), 'm');
    s = processChunk(buffer.slice(2, 4), 's');
    activeUnit = buffer.length <= 2 ? 'm' : 's';
  } else {
    h = processChunk(buffer.slice(0, 2), 'h');
    m = processChunk(buffer.slice(2, 4), 'm');
    s = processChunk(buffer.slice(4, 6), 's');
    activeUnit = 's';
  }

  return {
    units: {
      h: { value: h, cursor: 0 },
      m: { value: m, cursor: 0 },
      s: { value: s, cursor: 0 },
    },
    activeUnit,
  };
};

type DurationState = {
  isEditing: boolean;
  hasTyped: boolean;
  isCreationMode: boolean;
  finishedEntry: boolean;
  activeUnit: ActiveUnit;
  units: Record<ActiveUnit, UnitState>;
  buffer: string;
  initialSeconds: number;
};

type DurationAction =
  | { type: 'START_EDITING'; payload: { seconds: number; unit: ActiveUnit } }
  | { type: 'STOP_EDITING' }
  | { type: 'WRITE_DIGIT'; payload: string }
  | { type: 'BACKSPACE' }
  | { type: 'NAVIGATE'; payload: 'left' | 'right' }
  | { type: 'SET_ACTIVE_UNIT'; payload: ActiveUnit }
  | { type: 'DISABLE_CREATION_MODE' };

const initialState: DurationState = {
  isEditing: false,
  hasTyped: false,
  isCreationMode: false,
  finishedEntry: false,
  activeUnit: 'm',
  units: emptyUnits(),
  buffer: '',
  initialSeconds: 0,
};

const durationReducer = (state: DurationState, action: DurationAction): DurationState => {
  switch (action.type) {
    case 'START_EDITING': {
      const { seconds, unit } = action.payload;
      return {
        ...state,
        units: seconds ? secondsToUnits(seconds) : emptyUnits(),
        activeUnit: unit,
        isEditing: true,
        hasTyped: false,
        isCreationMode: seconds === 0,
        finishedEntry: false,
        buffer: '',
        initialSeconds: seconds,
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
      if (state.finishedEntry) return state;

      const newState = { ...state, hasTyped: true };

      if (newState.isCreationMode) {
        const nextBuffer = newState.buffer + digit;
        if (nextBuffer.length > 6) return newState;

        newState.buffer = nextBuffer;

        const { units, activeUnit } = parseBuffer(nextBuffer);
        newState.units = units;
        newState.activeUnit = activeUnit;
        return newState;
      }

      // Shift edit mode
      const unit = newState.units[newState.activeUnit];
      const nextValue = clamp(newState.activeUnit, unit.value[1] + digit);

      return {
        ...newState,
        units: {
          ...newState.units,
          [newState.activeUnit]: { value: nextValue, cursor: 1 },
        },
      };
    }

    case 'BACKSPACE': {
      const newState = { ...state };
      // Reset hasTyped logic akin to original
      newState.hasTyped = true;

      if (newState.finishedEntry) newState.finishedEntry = false;

      if (newState.isCreationMode) {
        if (newState.buffer.length === 0) return newState;
        const nextBuffer = newState.buffer.slice(0, -1);
        newState.buffer = nextBuffer;

        const { units, activeUnit } = parseBuffer(nextBuffer);
        newState.units = units;
        newState.activeUnit = activeUnit;
        return newState;
      }

      // Shift edit mode backspace
      const unit = newState.units[newState.activeUnit];
      if (unit.value !== '00') {
        const nextValue = '0' + unit.value[0];
        newState.units = {
          ...newState.units,
          [newState.activeUnit]: { value: nextValue, cursor: 1 },
        };
        return newState;
      }

      const prevUnit = getPrevUnit(newState.activeUnit);
      newState.activeUnit = prevUnit;
      // When moving back to prev unit, do we clear it? Or just focus it?
      // Standard behavior: just focus it.
      // But if we backtrack, maybe we want to delete last digit of prev unit?
      // Let's stick to navigation for now, or just focus.
      return newState;
    }

    case 'NAVIGATE': {
      const direction = action.payload;
      return {
        ...state,
        activeUnit:
          direction === 'left' ? getPrevUnit(state.activeUnit) : getNextUnit(state.activeUnit),
      };
    }

    case 'SET_ACTIVE_UNIT':
      return { ...state, activeUnit: action.payload };

    case 'DISABLE_CREATION_MODE':
      return { ...state, isCreationMode: false };

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
    ? state.hasTyped
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
          dispatch({ type: 'DISABLE_CREATION_MODE' });
        } else {
          startEditing(unit);
        }
      }}
    >
      <span className="duration-cell-digits-value">
        {focused && state.hasTyped && (
          <span className="duration-cell-caret" style={{ left: '100%' }} />
        )}
        <span>{u.value[0]}</span>
        <span>{u.value[1]}</span>
      </span>
      {unit && <span className={letterClass}>{unit}</span>}
    </span>
  );
};

const DurationCell = ({
  ...props
}: CellContext<TimesStopsRowNew, Duration | null> &
  Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> & {
    onChange?: (e: { target: { value: number } }) => void;
  }) => {
  const { onChange } = props || {};
  const [state, dispatch] = useReducer(durationReducer, initialState);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseDownRef = useRef(false);

  useEffect(() => {
    if (state.isEditing && containerRef.current) {
      containerRef.current.focus();
    }
  }, [state.isEditing]);

  const startEditing = (unit: ActiveUnit) => {
    const seconds = unitsToSeconds(state.units);
    const targetUnit = seconds === 0 ? 'm' : unit;
    dispatch({ type: 'START_EDITING', payload: { seconds, unit: targetUnit } });
  };

  const commit = () => {
    onChange?.({ target: { value: unitsToSeconds(state.units) } });
    dispatch({ type: 'STOP_EDITING' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!state.isEditing) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        commit();
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

  const isEdited = Object.values(state.units).some((u) => u.value !== '00');
  const showPlaceholder = !state.isEditing && !isEdited;

  const handleMouseDown = () => {
    mouseDownRef.current = true;
  };

  const handleMouseUp = () => {
    mouseDownRef.current = false;
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="duration-cell"
      onKeyDown={handleKeyDown}
      onFocus={() => {
        if (!mouseDownRef.current && !state.isEditing) startEditing('m');
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onBlur={() => {
        mouseDownRef.current = false;
        if (state.isEditing) commit();
      }}
      onClick={() => !state.isEditing && startEditing('m')}
    >
      {showPlaceholder ? (
        <CellPlaceholder onClick={() => {}} />
      ) : (
        UNITS.map((unit) => (
          <UnitDisplay
            key={unit}
            unit={unit}
            state={state}
            dispatch={dispatch}
            startEditing={startEditing}
            isEdited={isEdited}
          />
        ))
      )}
    </div>
  );
};

export default DurationCell;
