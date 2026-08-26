import { useEffect, useImperativeHandle, useReducer, useRef, type ChangeEvent } from 'react';

import type { CellContext } from '@tanstack/react-table';

import { SECONDS_IN_A_DAY } from 'utils/timeManipulation';

import CellPlaceholder from './CellPlaceholder';
import ClearButton from './ClearButton';
import TimePropagationMenu from './TimePropagationMenu';
import type { PropagationMode, TimesStopsRowNew } from './types';

// Types

type SectionState = string;

type Section = 'hours' | 'minutes' | 'seconds';

const SECTION_PLACEHOLDERS: Record<Section, string> = {
  hours: 'h',
  minutes: 'm',
  seconds: 's',
};

type TimeState = {
  hours: SectionState;
  minutes: SectionState;
  seconds: SectionState;
  focusedSection: Section | null;
  empty?: boolean;
  hasTyped: boolean;
};

type BlurIntent = 'none' | 'commit' | 'cancel';

export type TimeCellHandle = {
  focus: () => void;
};

type TimeAction =
  | { type: 'DIGIT_PRESSED'; digit: string }
  | { type: 'BACKSPACE_PRESSED' }
  | { type: 'ENTER_PRESSED' }
  | { type: 'ESCAPE_PRESSED'; value: Date | null }
  | { type: 'SECTION_CLICKED'; section: Section }
  | { type: 'FOCUSED'; section: Section }
  | { type: 'FOCUSED_WITH_PREFILL'; section: Section; prefillValue: Date }
  | { type: 'LEFT_ARROW_PRESSED' }
  | { type: 'RIGHT_ARROW_PRESSED' }
  | { type: 'BLURRED' }
  | { type: 'EXTERNAL_VALUE_CHANGED'; value: Date | null };

// Helpers

const formatSectionDigits = (str: string, section: Section): SectionState => {
  const digits = str.replace(/\D/g, '').slice(-2);
  const sectionPlaceholder = SECTION_PLACEHOLDERS[section];

  if (digits.length === 2) return digits;
  if (digits.length === 1) return sectionPlaceholder + digits;
  return sectionPlaceholder + sectionPlaceholder;
};

const parseTimeState = (
  date: Date | null
): Omit<TimeState, 'focusedSection' | 'empty' | 'hasTyped'> => {
  if (!date)
    return {
      hours: formatSectionDigits('', 'hours'),
      minutes: formatSectionDigits('', 'minutes'),
      seconds: formatSectionDigits('', 'seconds'),
    };

  const timeStr = date.toTimeString().slice(0, 8);
  const [hours, minutes, seconds] = timeStr.split(':');

  return {
    hours: formatSectionDigits(hours, 'hours'),
    minutes: formatSectionDigits(minutes, 'minutes'),
    seconds: formatSectionDigits(seconds, 'seconds'),
  };
};

const formatDisplay = (state: TimeState): string =>
  `${state.hours}:${state.minutes}:${state.seconds}`;

const digitCount = (sectionState: SectionState): number => sectionState.replace(/\D/g, '').length;

const hasAllDigits = (pair: SectionState): boolean => digitCount(pair) === 2;

const hasNoDigits = (pair: SectionState): boolean => digitCount(pair) === 0;

const addDigitformatSectionDigits = (
  sectionState: SectionState,
  digit: string,
  section: Section
): SectionState => {
  switch (digitCount(sectionState)) {
    case 0:
      return formatSectionDigits(digit, section);
    case 1:
      return formatSectionDigits(sectionState[1] + digit, section);
    case 2:
      return sectionState;
  }
  return sectionState;
};

const removeDigitFromSectionState = (
  sectionState: SectionState,
  section: Section
): SectionState => {
  switch (digitCount(sectionState)) {
    case 0:
      return formatSectionDigits('', section);
    case 1:
      return formatSectionDigits('', section);
    case 2:
      return formatSectionDigits(sectionState[1], section);
  }
  return sectionState;
};

const clampTimeState = (state: TimeState): TimeState => {
  const clampSection = (section: Section): SectionState => {
    let max = 59;
    if (section === 'hours') max = 23;

    const digits = state[section].replace(/\D/g, '');

    switch (digits.length) {
      case 0:
        return '00';
      case 1:
        if (parseInt(digits) * 10 > Math.floor(max)) {
          return digits.padStart(2, '0');
        }
        return digits.padEnd(2, '0');
      case 2:
        if (parseInt(digits) > max) {
          return max.toString().padStart(2, '0');
        }
        return digits;
    }
    return state[section];
  };

  return {
    hours: clampSection('hours'),
    minutes: clampSection('minutes'),
    seconds: clampSection('seconds'),
    focusedSection: state.focusedSection,
    hasTyped: state.hasTyped,
  };
};

// State transformers (pure functions used by the reducer)

// The minutes section needs special handling when overflowing
// It allows the user to quickly enter times like 01:45 by typing 0145 even when focused on minutes
const computeMinutesOverflowState = (state: TimeState, digit: string): TimeState => {
  if (!hasAllDigits(state.hours)) {
    return {
      ...state,
      hours: state.minutes,
      minutes: formatSectionDigits(digit, 'minutes'),
      focusedSection: 'minutes',
    };
  }

  if (!hasAllDigits(state.seconds)) {
    return {
      ...state,
      seconds: formatSectionDigits(digit, 'seconds'),
      focusedSection: 'seconds',
    };
  }

  return {
    ...state,
    minutes: formatSectionDigits(digit, 'minutes'),
  };
};

const computeNormalOverflowState = (state: TimeState, digit: string): TimeState => {
  const { focusedSection } = state;
  if (!focusedSection) return state;

  if (focusedSection === 'hours') {
    if (!hasAllDigits(state.minutes)) {
      return {
        ...state,
        minutes: formatSectionDigits(digit, 'minutes'),
        focusedSection: 'minutes',
      };
    }

    if (!hasAllDigits(state.seconds)) {
      return {
        ...state,
        seconds: formatSectionDigits(digit, 'seconds'),
        focusedSection: 'seconds',
      };
    }

    return {
      ...state,
      hours: formatSectionDigits(digit, 'hours'),
    };
  }

  if (focusedSection === 'seconds') {
    return {
      ...state,
      seconds: formatSectionDigits(digit, 'seconds'),
    };
  }

  return state;
};

const computeDigitState = (state: TimeState, digit: string): TimeState => {
  const { focusedSection } = state;
  if (!focusedSection) return state;

  const currentSectionState = state[focusedSection];

  // If user starts with minutes and enters a digit > 2
  // We prevent pushing "X0" invalid hours
  if (
    focusedSection === 'minutes' &&
    hasNoDigits(state.hours) &&
    hasNoDigits(state.minutes) &&
    parseInt(digit) > 2
  ) {
    return {
      ...state,
      hours: formatSectionDigits('00', 'hours'),
      minutes: addDigitformatSectionDigits(currentSectionState, digit, 'minutes'),
    };
  }

  switch (digitCount(currentSectionState)) {
    case 0:
      return {
        ...state,
        [focusedSection]: addDigitformatSectionDigits(currentSectionState, digit, focusedSection),
      };
    case 1: {
      const newFocusedSection = (): Section => {
        switch (focusedSection) {
          case 'hours':
            return 'minutes';
          case 'minutes':
            return hasNoDigits(state.hours) ? 'minutes' : 'seconds';
          case 'seconds':
            return 'seconds';
        }
      };
      return {
        ...state,
        [focusedSection]: addDigitformatSectionDigits(currentSectionState, digit, focusedSection),
        focusedSection: newFocusedSection(),
      };
    }
    case 2:
    default:
      return focusedSection === 'minutes'
        ? computeMinutesOverflowState(state, digit)
        : computeNormalOverflowState(state, digit);
  }
};

// When a section is emptied, we need to shift the other sections to the left
// This way the user can quickly delete time by holding backspace
const computeBackspaceShiftState = (state: TimeState, section: Section): TimeState => {
  if (section === 'seconds') {
    return {
      ...state,
      hours: formatSectionDigits('', 'hours'),
      minutes: formatSectionDigits(state.hours, 'minutes'),
      seconds: formatSectionDigits(state.minutes, 'seconds'),
    };
  } else if (section === 'minutes') {
    return {
      ...state,
      hours: formatSectionDigits('', 'hours'),
      minutes: formatSectionDigits(state.hours, 'minutes'),
      focusedSection: hasNoDigits(state.hours) ? 'seconds' : 'minutes',
    };
  }
  return {
    ...state,
    hours: formatSectionDigits('', 'hours'),
    focusedSection: 'minutes',
  };
};

const computeBackspaceState = (state: TimeState): TimeState => {
  const { focusedSection } = state;
  if (!focusedSection) return state;

  const currentSectionState = state[focusedSection];

  if (hasNoDigits(currentSectionState)) return state;

  const newSectionState = removeDigitFromSectionState(currentSectionState, focusedSection);

  if (hasNoDigits(newSectionState)) {
    return computeBackspaceShiftState(state, focusedSection);
  }

  return {
    ...state,
    [focusedSection]: newSectionState,
  };
};

const computeBlurState = (state: TimeState): TimeState => {
  if (hasNoDigits(state.hours) && hasNoDigits(state.minutes) && hasNoDigits(state.seconds)) {
    return {
      hours: 'hh',
      minutes: 'mm',
      seconds: 'ss',
      focusedSection: null,
      empty: true,
      hasTyped: false,
    };
  }
  return clampTimeState({
    ...state,
    focusedSection: null,
  });
};

const computeFocusState = (state: TimeState, section: Section): TimeState => ({
  ...state,
  focusedSection: section,
  empty: false,
  hasTyped: state.empty || false,
});

const computeSectionClickState = (state: TimeState, section: Section): TimeState => ({
  ...state,
  focusedSection: section,
  hasTyped: state.empty || false,
});

const computeFocusedWithPrefillState = (
  state: TimeState,
  section: Section,
  prefillValue: Date
): TimeState => ({
  ...parseTimeState(prefillValue),
  focusedSection: section,
  empty: false,
  hasTyped: state.empty || false,
});

const computeArrowState = (state: TimeState, direction: 'left' | 'right'): TimeState => {
  const { focusedSection } = state;
  if (!focusedSection) return state;

  const newFocusedSection = () => {
    if (direction === 'left') {
      switch (focusedSection) {
        case 'hours':
          return 'hours';
        case 'minutes':
          return 'hours';
        case 'seconds':
          return 'minutes';
      }
    } else {
      switch (focusedSection) {
        case 'hours':
          return 'minutes';
        case 'minutes':
          return 'seconds';
        case 'seconds':
          return 'seconds';
      }
    }
  };

  return {
    ...state,
    focusedSection: newFocusedSection(),
    hasTyped: false,
  };
};

const initialTimeState = (controlledValue: Date | null): TimeState => ({
  ...parseTimeState(controlledValue),
  focusedSection: null,
  empty: controlledValue === null,
  hasTyped: controlledValue === null,
});

// Reducer

const timeReducer = (state: TimeState, action: TimeAction): TimeState => {
  switch (action.type) {
    case 'DIGIT_PRESSED':
      return { ...computeDigitState(state, action.digit), hasTyped: true };
    case 'BACKSPACE_PRESSED':
      return { ...computeBackspaceState(state), hasTyped: true };
    case 'BLURRED':
      return computeBlurState(state);
    case 'FOCUSED':
      return computeFocusState(state, action.section);
    case 'FOCUSED_WITH_PREFILL':
      return computeFocusedWithPrefillState(state, action.section, action.prefillValue);
    case 'SECTION_CLICKED':
      return computeSectionClickState(state, action.section);
    case 'ENTER_PRESSED':
      return computeBlurState(state);
    case 'ESCAPE_PRESSED':
      return initialTimeState(action.value);
    case 'LEFT_ARROW_PRESSED':
      return computeArrowState(state, 'left');
    case 'RIGHT_ARROW_PRESSED':
      return computeArrowState(state, 'right');
    case 'EXTERNAL_VALUE_CHANGED':
      // Don't override user's in-progress edits
      if (state.focusedSection) return state;
      return initialTimeState(action.value);
    default:
      return state;
  }
};

// Helpers for commit

/**
 * Build a Date from the time state using referenceDate as the calendar day base.
 * If the resulting time is before referenceDate, assume it's the next day.
 */
const buildDateFromState = (state: TimeState, referenceDate: Date): Date | null => {
  if (state.empty) return null;

  const hours = parseInt(state.hours, 10);
  const minutes = parseInt(state.minutes, 10);
  const seconds = parseInt(state.seconds, 10);

  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;

  const result = new Date(referenceDate);
  result.setHours(hours, minutes, seconds, 0);

  // If the result is before the reference, assume the user meant the next day
  if (result < referenceDate) {
    result.setTime(result.getTime() + SECONDS_IN_A_DAY * 1000);
  }

  return result;
};

// Component

const renderTimeSection = (value: string, focused: boolean, hasTyped: boolean) => (
  <span
    className={`value ${focused ? (hasTyped ? 'value-focused' : 'value-focused-initial') : ''}`}
  >
    {focused && hasTyped && <span className="custom-caret" />}
    <span
      className={/\d/.test(value[0]) ? '' : `placeholder-letter placeholder-letter-${value[0]}`}
    >
      {value[0]}
    </span>
    <span
      className={/\d/.test(value[1]) ? '' : `placeholder-letter placeholder-letter-${value[1]}`}
    >
      {value[1]}
    </span>
  </span>
);

type TimeCellProps = CellContext<TimesStopsRowNew, Date | null> &
  React.InputHTMLAttributes<HTMLInputElement> & {
    /** Reference date used as the calendar day base. If the entered time is before this date, the next day is assumed. */
    referenceDate?: Date;
    /** When the cell is empty, pre-fill the input with this value when the user focuses to edit. */
    prefillValue?: Date | null;
    /** Title for the clear button. */
    clearButtonTitle?: string;
    /** Called after Enter validates the input. Use to move focus (e.g. to the cell below). */
    onEnterKeyDown?: () => void;
    /** Called on Tab key to move focus to the next/previous editable time cell. */
    onTabKeyDown?: (direction: 'forward' | 'backward') => boolean;
    onCommit?: (date: Date | null, propagationMode: PropagationMode) => void;
    disableClear?: boolean;
    ref?: React.Ref<TimeCellHandle>;
  };

const TimeCell = ({
  getValue,
  referenceDate,
  prefillValue,
  clearButtonTitle,
  onEnterKeyDown,
  onTabKeyDown,
  onCommit,
  disableClear,
  ref,
  ...props
}: TimeCellProps) => {
  const { row, table, column, disabled, onKeyDown, onBlur, onFocus, onChange, ...userProps } =
    props || {};

  const controlledValue = getValue();
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldPrefillRef = useRef(false);
  const blurIntentRef = useRef<BlurIntent>('none');

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        inputRef.current?.focus();
      },
    }),
    []
  );
  const [state, dispatch] = useReducer(timeReducer, controlledValue, initialTimeState);

  const handleSelectPropagationMode = (mode: PropagationMode) => {
    if (!onCommit || !referenceDate) return;
    const newDate = buildDateFromState(computeBlurState(state), referenceDate);
    onCommit(newDate, mode);
    blurIntentRef.current = 'cancel';
    inputRef.current?.blur();
  };

  const getSectionFromPosition = (position: number): Section => {
    if (position <= 2) return 'hours';
    if (position <= 5) return 'minutes';
    return 'seconds';
  };

  const selectSection = (section: Section) => {
    if (!inputRef.current) return;
    const positions = {
      hours: [0, 2],
      minutes: [3, 5],
      seconds: [6, 8],
    };
    const [start, end] = positions[section];
    inputRef.current.setSelectionRange(start, end);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        blurIntentRef.current = 'commit';
        onEnterKeyDown?.();
        e.currentTarget.blur();
        break;
      case 'Escape':
        e.preventDefault();
        blurIntentRef.current = 'cancel';
        e.currentTarget.blur();
        break;
      case 'Tab':
        blurIntentRef.current = 'commit';
        if (onTabKeyDown?.(e.shiftKey ? 'backward' : 'forward')) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        break;
      case 'Backspace':
        e.preventDefault();
        dispatch({ type: 'BACKSPACE_PRESSED' });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        dispatch({ type: 'LEFT_ARROW_PRESSED' });
        break;
      case 'ArrowRight':
        e.preventDefault();
        dispatch({ type: 'RIGHT_ARROW_PRESSED' });
        break;
      default:
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          dispatch({ type: 'DIGIT_PRESSED', digit: e.key });
        }
        if (e.key.length === 1) {
          e.preventDefault();
        }
    }

    onKeyDown?.(e);
  };

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const position = e.currentTarget.selectionStart || 0;
    const section = getSectionFromPosition(position);
    dispatch({ type: 'SECTION_CLICKED', section });
  };

  const handleClear = () => {
    if (controlledValue !== null) onCommit?.(null, 'atThisWaypoint');
    dispatch({ type: 'ESCAPE_PRESSED', value: null });
  };

  const handlePlaceholderClick = () => {
    shouldPrefillRef.current = true;
    inputRef.current?.focus();
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const shouldPrefill = shouldPrefillRef.current;
    shouldPrefillRef.current = false;

    let section: Section;
    if (state.empty) {
      section = 'minutes';
      if (prefillValue && shouldPrefill) {
        dispatch({ type: 'FOCUSED_WITH_PREFILL', section, prefillValue });
        onFocus?.(e);
        return;
      }
    } else {
      const position = e.currentTarget.selectionStart || 0;
      section = getSectionFromPosition(position);
    }
    dispatch({ type: 'FOCUSED', section });
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const blurIntent = blurIntentRef.current;

    if (blurIntent === 'cancel') {
      blurIntentRef.current = 'none';
      dispatch({ type: 'ESCAPE_PRESSED', value: controlledValue });
      onBlur?.(e);
      return;
    }

    // Commit first: useReducer updates are async, so we compute the clamped state
    // ourselves rather than waiting for the BLURRED dispatch to take effect.
    // This ensures "14:45" (no seconds) commits as "14:45:00" instead of null.

    if (onCommit && referenceDate) {
      const newDate = buildDateFromState(computeBlurState(state), referenceDate);
      const hasChanged = newDate?.getTime() !== controlledValue?.getTime();
      if (hasChanged) {
        if (blurIntent === 'commit') {
          setTimeout(() => onCommit(newDate, 'atThisWaypoint'), 0);
        } else {
          onCommit(newDate, 'atThisWaypoint');
        }
      }
    }

    dispatch({ type: 'BLURRED' });
    blurIntentRef.current = 'none';
    onBlur?.(e);
  };

  // Sync internal state when the external controlled value changes (e.g., after simulation re-run).
  // Skip sync while the user is editing (focusedSection !== null) — handled by the reducer guard.
  useEffect(() => {
    dispatch({ type: 'EXTERNAL_VALUE_CHANGED', value: controlledValue });
  }, [controlledValue?.getTime()]);

  useEffect(() => {
    if (state.focusedSection) {
      selectSection(state.focusedSection);
    }
  }, [state.focusedSection, state.hours, state.minutes, state.seconds]);

  useEffect(() => {
    const displayValue = formatDisplay(state);
    onChange?.({
      target: { value: displayValue },
    } as ChangeEvent<HTMLInputElement>);
  }, [state.hours, state.minutes, state.seconds, onChange]);

  const isTimeComplete =
    hasAllDigits(state.hours) && hasAllDigits(state.minutes) && hasAllDigits(state.seconds);
  const editedDate =
    isTimeComplete && referenceDate ? buildDateFromState(state, referenceDate) : null;
  const shouldShowPropagationMenu =
    controlledValue !== null && !disabled && state.focusedSection !== null && state.hasTyped;
  const isFirstRow = row.index === 0;
  const isLastRow = row.index === table.getRowCount() - 1;

  return (
    <>
      <div className={`time-cell ${state.empty ? 'time-cell--empty' : ''}`}>
        <input
          ref={inputRef}
          value={state.empty ? 'hh:mm:ss' : formatDisplay(state)}
          className="time-cell__input"
          data-testid={
            column?.id === 'requestedArrival' ? 'requested-arrival' : 'requested-departure'
          }
          style={{ pointerEvents: state.empty ? 'none' : 'auto' }}
          onChange={(e) => e.preventDefault()}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...userProps}
        />

        {!state.empty ? (
          <div
            className={`time-cell__display ${
              !state.focusedSection ? 'time-cell__display--saved' : ''
            }`}
            aria-hidden="true"
          >
            {renderTimeSection(state.hours, state.focusedSection === 'hours', state.hasTyped)}
            <span className="separator">:</span>
            {renderTimeSection(state.minutes, state.focusedSection === 'minutes', state.hasTyped)}
            <span className="separator">:</span>
            {renderTimeSection(state.seconds, state.focusedSection === 'seconds', state.hasTyped)}
          </div>
        ) : (
          <CellPlaceholder onClick={handlePlaceholderClick} />
        )}
        <TimePropagationMenu
          isOpen={shouldShowPropagationMenu}
          anchorRef={{ current: inputRef.current?.closest('td') ?? null }}
          oldValue={controlledValue}
          newValue={editedDate}
          onSelectMode={handleSelectPropagationMode}
          disableFromDeparture={column.id === 'requestedArrival' && isFirstRow}
          disableToDestination={isLastRow}
          isOriginArrival={column.id === 'requestedArrival' && isFirstRow}
        />
      </div>
      <ClearButton
        isVisible={state.focusedSection !== null && !state.empty && !disableClear}
        containerRef={inputRef}
        title={clearButtonTitle}
        onClear={handleClear}
      />
    </>
  );
};

export default TimeCell;
