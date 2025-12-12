import { useState } from 'react';

const TIME_MASK = [
  { char: '-', isEditable: true, pattern: /[0-2]/, value: 'hours' },
  { char: '-', isEditable: true, pattern: /[0-9]/, value: 'hours' },
  { char: ':', isEditable: false, pattern: null },
  { char: '-', isEditable: true, pattern: /[0-5]/, value: 'minutes' },
  { char: '-', isEditable: true, pattern: /[0-9]/, value: 'minutes' },
  { char: ':', isEditable: false, pattern: null },
  { char: '-', isEditable: true, pattern: /[0-5]/, value: 'seconds' },
  { char: '-', isEditable: true, pattern: /[0-9]/, value: 'seconds' },
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

    if (digitIndex < rawDigits.length && maskInfo.pattern!.test(rawDigits[digitIndex])) {
      result += rawDigits[digitIndex];
      digitIndex++;
    } else {
      result += maskInfo.char;
      digitIndex++;
    }
  }

  return result;
};

// Utility to delay execution until after render
function delayAfterRender(callback: () => void) {
  setTimeout(() => {
    callback();
  }, 0);
}

// Get the next editable position in the input considering the mask
const getNextEditablePosition = (pos: number): number => {
  for (let i = pos; i < TIME_MASK.length; i++) {
    if (TIME_MASK[i].isEditable) return i;
  }
  return TIME_MASK.length;
};

const TimeCell = (
  ctx: {
    getValue: () => Date | null;
  },
  // Let the parent component handle the onChange if provided
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void,
  props?: React.InputHTMLAttributes<HTMLInputElement>
) => {
  const controlledValue = ctx.getValue();
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
      const maskInfo = TIME_MASK[cursorPos - 1];
      const insertedChar = rawInput[cursorPos - 1];

      // Case when we want to prevent invalid character input
      if (maskInfo.isEditable && !maskInfo.pattern!.test(insertedChar)) {
        setDisplayValue(displayValue);
        delayAfterRender(() => {
          input.setSelectionRange(cursorPos - 1, cursorPos - 1);
        });
        return;
      }

      // Removing duplicate char caused by React's controlled input behavior
      const newRawInput = rawInput.slice(0, cursorPos) + rawInput.slice(cursorPos + 1);

      const newDigits = newRawInput.replace(/[^0-9]/g, '').slice(0, 6);
      const newDisplayValue = applyMask(newDigits);

      if (onChange) {
        onChange({ ...e, target: { ...e.target, value: newDisplayValue } });
      } else {
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

      if (onChange) {
        onChange({ ...e, target: { ...e.target, value: newDisplayValue } });
      } else {
        setDisplayValue(newDisplayValue);
      }

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
      if (onChange) {
        onChange({ ...e, target: { ...e.target, value: newDisplayValue } });
      } else {
        setDisplayValue(newDisplayValue);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('Text');
    const rawDigits = pasteData.replace(/[^0-9]/g, '').slice(0, 6);
    const newDisplayValue = applyMask(rawDigits);

    if (onChange) {
      onChange({ ...e, target: { ...(e.target as HTMLInputElement), value: newDisplayValue } });
    } else {
      setDisplayValue(newDisplayValue);
    }

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

  return (
    <input
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPaste={handlePaste}
      {...props}
    />
  );
};

export default TimeCell;
