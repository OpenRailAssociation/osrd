import React, {
  type ChangeEventHandler,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';

import { ChevronDown, XCircle } from '@osrd-project/ui-icons';
import cx from 'classnames';

import useOutsideClick from '../../../hooks/useOutsideClick';
import Input, { type InputProps } from '../Input';

export type ComboBoxProps<T> = Omit<InputProps, 'value'> & {
  value?: T;
  suggestions: Array<T>;
  customLabel?: ReactNode;
  numberOfSuggestionsToShow?: number;
  getSuggestionLabel: (option: T) => string;
  onSelectSuggestion: (option: T | undefined) => void;
  resetSuggestions: () => void;
  testIdPrefix?: string;
};

/**
 * ComboBox component
 *
 * You can use the hook useDefaultComboBox to get the default behavior.
 * See the stories.
 */
const ComboBox = <T,>({
  suggestions,
  customLabel,
  numberOfSuggestionsToShow = 5,
  value,
  small,
  getSuggestionLabel,
  onChange,
  onSelectSuggestion,
  resetSuggestions,
  testIdPrefix,
  ...inputProps
}: ComboBoxProps<T>) => {
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [inputValue, setInputValue] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const suggestionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLInputElement>(null);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  const removeFocus = () => {
    setIsInputFocused(false);
    setActiveSuggestionIndex(-1);
    setTimeout(() => {
      inputRef.current?.blur();
    }, 0);
    resetSuggestions();
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (value) {
      setInputValue(getSuggestionLabel(value));
    } else {
      setInputValue('');
    }
  }, [value]);

  const showSuggestions = useMemo(
    () => isInputFocused && suggestions.length > 0 && !inputProps.disabled,
    [isInputFocused, suggestions.length, inputProps.disabled]
  );

  // behavior
  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    onChange?.(e);
    setInputValue(e.currentTarget.value);
  };

  const selectSuggestion = (index: number) => {
    const selectedSuggestion = suggestions.at(index)!;
    onSelectSuggestion(selectedSuggestion);
    setInputValue(getSuggestionLabel(selectedSuggestion));
    removeFocus();
  };

  const closeSuggestions = () => {
    setInputValue(value ? getSuggestionLabel(value) : '');
    removeFocus();
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'ArrowDown') {
      setActiveSuggestionIndex((prev) => {
        const newIndex = prev < suggestions.length - 1 ? prev + 1 : prev;
        if (suggestionRefs.current[newIndex]) {
          suggestionRefs.current[newIndex].scrollIntoView({
            block: 'nearest',
          });
        }
        return newIndex;
      });
    } else if (e.key === 'ArrowUp') {
      setActiveSuggestionIndex((prev) => {
        const newIndex = prev > 0 ? prev - 1 : prev;
        if (suggestionRefs.current[newIndex]) {
          suggestionRefs.current[newIndex].scrollIntoView({
            block: 'nearest',
          });
        }
        return newIndex;
      });
    } else if ((e.key === 'Enter' || e.key === 'Tab') && activeSuggestionIndex >= 0) {
      selectSuggestion(activeSuggestionIndex);
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  };

  const handleInputFocus: FocusEventHandler<HTMLInputElement> = (e) => {
    e.stopPropagation();
    setIsInputFocused(true);
  };

  const clearInput = () => {
    setInputValue('');
    onSelectSuggestion(undefined);
    resetSuggestions();
    focusInput();
  };

  useOutsideClick(wrapperRef, closeSuggestions);

  const inputIcons = useMemo(() => {
    if (inputProps.readOnly || inputProps.disabled) return undefined;
    return [
      // Conditionally include the clear icon only when input is not empty
      ...(value
        ? [
            {
              icon: <XCircle variant="fill" />,
              action: clearInput,
              className: 'clear-icon',
            },
          ]
        : []),
      // chevron of the select
      {
        icon: <ChevronDown size={small ? 'sm' : 'lg'} />,
        action: focusInput,
        className: cx('chevron-icon', {
          disabled: inputProps.disabled,
        }),
      },
    ];
  }, [inputProps.readOnly, inputProps.disabled, clearInput, value, small, focusInput]);

  return (
    <div
      data-testid={testIdPrefix ? `${testIdPrefix}` : undefined}
      className="ui-combo-box"
      style={{ '--number-of-suggestions': numberOfSuggestionsToShow } as React.CSSProperties}
      ref={wrapperRef}
    >
      {customLabel && <label htmlFor={inputProps.id}>{customLabel}</label>}
      <Input
        testIdPrefix={inputProps.id}
        {...inputProps}
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleInputFocus}
        withIcons={inputIcons}
        small={small}
      />
      {showSuggestions && (
        <ul
          className="suggestions-list"
          data-testid={testIdPrefix ? `${testIdPrefix}-list` : undefined}
        >
          {suggestions.map((suggestion, index) => (
            <li
              ref={(el) => {
                if (suggestionRefs) {
                  suggestionRefs.current[index] = el;
                }
              }}
              key={`${getSuggestionLabel(suggestion)}-${index}`}
              data-testid={testIdPrefix ? `${testIdPrefix}-item` : undefined}
              className={cx('suggestion-item', {
                active: index === activeSuggestionIndex,
                selected: value && getSuggestionLabel(value) === getSuggestionLabel(suggestion),
                small,
              })}
              onClick={() => selectSuggestion(index)}
              onMouseDown={(e) => e.preventDefault()} // Prevents the div parent (.ui-combo-box) from losing focus
              onMouseEnter={() => {
                setActiveSuggestionIndex(index);
              }}
            >
              {getSuggestionLabel(suggestion)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ComboBox;
