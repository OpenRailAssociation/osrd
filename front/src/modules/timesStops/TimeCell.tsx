import { useEffect, useReducer, useRef, type ChangeEvent } from 'react';

import type { CellContext } from '@tanstack/react-table';

import type { TimesStopsRowNew } from './types';

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
};

type TimeAction =
  | { type: 'DIGIT_PRESSED'; digit: string }
  | { type: 'BACKSPACE_PRESSED' }
  | { type: 'ENTER_PRESSED' }
  | { type: 'SECTION_CLICKED'; section: Section }
  | { type: 'FOCUSED'; section: Section }
  | { type: 'LEFT_ARROW_PRESSED' }
  | { type: 'RIGHT_ARROW_PRESSED' }
  | { type: 'BLURRED' };

// Helpers

const formatSectionDigits = (str: string, section: Section): SectionState => {
  const digits = str.replace(/\D/g, '').slice(-2);
  const sectionPlaceholder = SECTION_PLACEHOLDERS[section];

  if (digits.length === 2) return digits;
  if (digits.length === 1) return sectionPlaceholder + digits;
  return sectionPlaceholder + sectionPlaceholder;
};

const parseTimeState = (date: Date | null): Omit<TimeState, 'focusedSection' | 'empty'> => {
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
  };
};

// Handlers

// The minutes section needs special handling when overflowing
// It allows the user to quickly enter times like 01:45 by typing 0145 even when focused on minutes
const handleMinutesOverflow = (state: TimeState, digit: string): TimeState => {
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

const handleNormalOverflow = (state: TimeState, digit: string): TimeState => {
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

const handleDigitPressed = (state: TimeState, digit: string): TimeState => {
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
        ? handleMinutesOverflow(state, digit)
        : handleNormalOverflow(state, digit);
  }
};

// When a section is emptied, we need to shift the other sections to the left
// This way the user can quickly delete time by holding backspace
const handleBackspaceShift = (state: TimeState, section: Section): TimeState => {
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

const handleBackspacePressed = (state: TimeState): TimeState => {
  const { focusedSection } = state;
  if (!focusedSection) return state;

  const currentSectionState = state[focusedSection];

  if (hasNoDigits(currentSectionState)) return state;

  const newSectionState = removeDigitFromSectionState(currentSectionState, focusedSection);

  if (hasNoDigits(newSectionState)) {
    return handleBackspaceShift(state, focusedSection);
  }

  return {
    ...state,
    [focusedSection]: newSectionState,
  };
};

const handleBlurred = (state: TimeState): TimeState => {
  if (hasNoDigits(state.hours) && hasNoDigits(state.minutes) && hasNoDigits(state.seconds)) {
    return {
      hours: 'hh',
      minutes: 'mm',
      seconds: 'ss',
      focusedSection: null,
      empty: true,
    };
  }
  return clampTimeState({
    ...state,
    focusedSection: null,
  });
};

const handleFocused = (state: TimeState, section: Section): TimeState => ({
  ...state,
  focusedSection: section,
  empty: false,
});

const handleSectionClicked = (state: TimeState, section: Section): TimeState => ({
  ...state,
  focusedSection: section,
});

const handleHorizontalArrow = (state: TimeState, direction: 'left' | 'right'): TimeState => {
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
  };
};

// Reducer

const timeReducer = (state: TimeState, action: TimeAction): TimeState => {
  switch (action.type) {
    case 'DIGIT_PRESSED':
      return handleDigitPressed(state, action.digit);
    case 'BACKSPACE_PRESSED':
      return handleBackspacePressed(state);
    case 'BLURRED':
      return handleBlurred(state);
    case 'FOCUSED':
      return handleFocused(state, action.section);
    case 'SECTION_CLICKED':
      return handleSectionClicked(state, action.section);
    case 'ENTER_PRESSED':
      return handleBlurred(state);
    case 'LEFT_ARROW_PRESSED':
      return handleHorizontalArrow(state, 'left');
    case 'RIGHT_ARROW_PRESSED':
      return handleHorizontalArrow(state, 'right');
    default:
      return state;
  }
};

const initialTimeState = (controlledValue: Date | null): TimeState => ({
  ...parseTimeState(controlledValue),
  focusedSection: null,
  empty: controlledValue === null,
});

// Component

const TimeCell = ({
  getValue,
  ...props
}: CellContext<TimesStopsRowNew, Date | null> & React.InputHTMLAttributes<HTMLInputElement>) => {
  const { onKeyDown, onBlur, onFocus, onChange, ...userProps } = props || {};

  const controlledValue = getValue();
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, dispatch] = useReducer(timeReducer, controlledValue, initialTimeState);

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
        e.currentTarget.blur();
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

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const position = e.currentTarget.selectionStart || 0;
    const section = getSectionFromPosition(position);
    dispatch({ type: 'FOCUSED', section });
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    dispatch({ type: 'BLURRED' });
    onBlur?.(e);
  };

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

  return (
    <div className="time-cell">
      <input
        ref={inputRef}
        value={state.empty ? 'hh:mm:ss' : formatDisplay(state)}
        className="time-cell__input"
        onChange={(e) => e.preventDefault()}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...userProps}
      />

      {!state.empty && (
        <div className="time-cell__display" aria-hidden="true">
          <span className={state.hours.includes('h') ? 'placeholder' : 'value'}>{state.hours}</span>
          <span className="separator">:</span>
          <span className={state.minutes.includes('m') ? 'placeholder' : 'value'}>
            {state.minutes}
          </span>
          <span className="separator">:</span>
          <span className={state.seconds.includes('s') ? 'placeholder' : 'value'}>
            {state.seconds}
          </span>
        </div>
      )}

      {state.empty && <span className="time-cell__placeholder">+</span>}
    </div>
  );
};

export default TimeCell;
