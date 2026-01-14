import { useState, useEffect } from 'react';

import type { CellContext } from '@tanstack/react-table';

import type { TimesStopsRowNew, TableMeta } from './types';

const TIME_MASK = [
  { char: '-', isEditable: true, value: 'twentyTens' },
  { char: '-', isEditable: true, value: 'twentyUnits' },
  { char: ':', isEditable: false },
  { char: '-', isEditable: true, value: 'sixtyTens' },
  { char: '-', isEditable: true, value: 'sixtyUnits' },
  { char: ':', isEditable: false },
  { char: '-', isEditable: true, value: 'sixtyTens' },
  { char: '-', isEditable: true, value: 'sixtyUnits' },
];

// Converts a raw digit string into a masked time string
// e.g., "123456" -> "12:34:56"
const applyMask = (rawDigits: string): string => {
  let result = '';
  let digitIndex = 0;

  for (const maskInfo of TIME_MASK) {
    if (!maskInfo.isEditable) {
      result += maskInfo.char;
      continue;
    }

    if (digitIndex < rawDigits.length) {
      switch (maskInfo.value) {
        case 'twentyTens': {
          const tensDigit = parseInt(rawDigits[digitIndex], 10);
          if (tensDigit > 2) {
            result += '2';
            digitIndex++;
            continue;
          }
          break;
        }
        case 'twentyUnits': {
          const tensDigit = parseInt(result[0], 10);
          const unitDigit = parseInt(rawDigits[digitIndex], 10);
          if (tensDigit === 2 && unitDigit > 3) {
            result += '3';
            digitIndex++;
            continue;
          }
          break;
        }
        case 'sixtyTens': {
          const tensDigit = parseInt(rawDigits[digitIndex], 10);
          if (tensDigit > 5) {
            result += '5';
            digitIndex++;
            continue;
          }
          break;
        }
        default:
          break;
      }

      result += rawDigits[digitIndex];
      digitIndex++;
    } else {
      result += maskInfo.char;
      digitIndex++;
    }
  }

  return result;
};

// Converts a masked time string into a usable Date parts
const processMask = (maskedDate: string): { hours: number; minutes: number; seconds: number } => {
  const parts = maskedDate.split(':');

  return {
    hours: Number(parts[0]),
    minutes: Number(parts[1]),
    seconds: Number(parts[2]),
  };
};

// Utility to delay execution until after render
function delayAfterRender(callback: () => void) {
  queueMicrotask(callback);
}

// Get the next editable position in the input considering the mask
const getNextEditablePosition = (pos: number): number => {
  for (let i = pos; i < TIME_MASK.length; i++) {
    if (TIME_MASK[i].isEditable) return i;
  }
  return TIME_MASK.length;
};

const TimeCell = ({
  getValue,
  row: { index },
  column: { id },
  table,
}: CellContext<TimesStopsRowNew, Date | null>) => {
  const controlledValue = getValue();
  const [displayValue, setDisplayValue] = useState<string>(() => {
    const date = controlledValue
      ? controlledValue.toTimeString().slice(0, 8).replace(/:/g, '')
      : '';
    return applyMask(date);
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const input = e.target;
    const rawInput = input.value;

    const cursorPos = input.selectionStart || 0;

    if (cursorPos < 0 || cursorPos > TIME_MASK.length) return;

    // If we are inserting characters
    if (rawInput.length >= displayValue.length) {
      // Removing duplicate char caused by React's controlled input behavior
      const newRawInput = rawInput.slice(0, cursorPos) + rawInput.slice(cursorPos + 1);

      const newDigits = newRawInput.replace(/[^0-9]/g, '').slice(0, 6);

      // filtering non numeric characters
      if (newDigits.length >= 6) {
        const newDisplayValue = applyMask(newDigits);
        setDisplayValue(newDisplayValue);
      }

      delayAfterRender(() => {
        if (input === document.activeElement) {
          const nextPos = getNextEditablePosition(cursorPos);
          input.setSelectionRange(nextPos, nextPos);
        }
      });
    }
    // If we are removing characters
    else if (rawInput.length < displayValue.length) {
      const maskInfo = TIME_MASK[cursorPos];

      if (!maskInfo.isEditable) {
        delayAfterRender(() => {
          input.setSelectionRange(cursorPos, cursorPos);
        });
        return;
      }

      const newRawInput = rawInput.slice(0, cursorPos) + '0' + rawInput.slice(cursorPos);

      const newDigits = newRawInput
        .replace(/[^0-9]/g, '')
        .slice(0, 6)
        .padEnd(6, '0');
      const newDisplayValue = applyMask(newDigits);

      setDisplayValue(newDisplayValue);

      delayAfterRender(() => {
        if (input === document.activeElement) {
          input.setSelectionRange(cursorPos, cursorPos);
        }
      });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // If no digits were entered, reset to empty mask
    const inputValue = e.target.value;
    const allFilled = /[1-9]/.test(inputValue);

    if (!allFilled) {
      const newDisplayValue = applyMask('');
      setDisplayValue(newDisplayValue);
    }
    const time = processMask(inputValue);
    (table.options.meta as TableMeta).updateTime(index, id, time.hours, time.minutes, time.seconds);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('Text');
    const rawDigits = pasteData.replace(/[^0-9]/g, '').slice(0, 6);
    const newDisplayValue = applyMask(rawDigits);

    setDisplayValue(newDisplayValue);

    delayAfterRender(() => {
      const input = e.target as HTMLInputElement;
      const firstPos = getNextEditablePosition(0);
      input.setSelectionRange(firstPos, firstPos);
    });
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const input = e.target;
    const cursorPos = input.selectionStart || 0;

    // On focus, if any editable position is still the placeholder, set it to '0'
    setDisplayValue((prev) => {
      let newValue = '';
      for (let i = 0; i < TIME_MASK.length; i++) {
        if (TIME_MASK[i].isEditable) {
          newValue += prev[i] === TIME_MASK[i].char ? '0' : prev[i];
        } else {
          newValue += TIME_MASK[i].char;
        }
      }
      return newValue;
    });

    delayAfterRender(() => {
      const firstPos = getNextEditablePosition(cursorPos);
      e.target.setSelectionRange(firstPos, firstPos);
    });
  };

  useEffect(() => {
    const date = controlledValue
      ? controlledValue.toTimeString().slice(0, 8).replace(/:/g, '')
      : '';
    setDisplayValue(applyMask(date));
  }, [controlledValue]);

  return (
    <input
      value={displayValue.includes('-') ? '+' : displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPaste={handlePaste}
    />
  );
};

export default TimeCell;
