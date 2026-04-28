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

import useOutsideClick from '../../hooks/useOutsideClick';
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
  renderListElementComponent?: (params: {
    suggestion: T;
    index: number;
    isActive: boolean;
    isSelected: boolean;
  }) => ReactNode;
  renderFooterItem?: () => ReactNode;

  allowCustomValue?: boolean;
  onAddCustomValue?: (value: string) => void;
  addCustomValueLabel?: string;
};

/**
 * ComboBox component
 *
 * You can use the hook useDefaultComboBox to get the default behavior.
 * See the stories.
 *
 * When `allowCustomValue` is true, an option appears at the bottom of the dropdown
 * when the typed value doesn't match any existing suggestion.
 * Defocusing without selecting cancels the input.
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
  renderListElementComponent,
  renderFooterItem,
  allowCustomValue = false,
  onAddCustomValue,
  addCustomValueLabel,
  ...inputProps
}: ComboBoxProps<T>) => {
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [inputValue, setInputValue] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const suggestionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLInputElement>(null);

  const removeFocus = () => {
    setIsInputFocused(false);
    setActiveSuggestionIndex(-1);
    setTimeout(() => {
      inputRef.current?.blur();
    }, 0);
    resetSuggestions();
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  const focusInput = useCallback(() => {
    if (isInputFocused) {
      removeFocus();
    } else {
      inputRef.current?.focus();
    }
  }, [inputRef, isInputFocused]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (value) {
      // TODO: fix this lint
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setInputValue(getSuggestionLabel(value));
    } else {
      setInputValue('');
    }
  }, [value]);

  const showAddCustomValue = useMemo(() => {
    if (!allowCustomValue || !inputValue.trim()) return false;
    return !suggestions.some(
      (s) => getSuggestionLabel(s).toLowerCase() === inputValue.trim().toLowerCase()
    );
  }, [allowCustomValue, inputValue, suggestions, getSuggestionLabel]);

  const showSuggestions = useMemo(
    () => isInputFocused && (suggestions.length > 0 || showAddCustomValue) && !inputProps.disabled,
    [isInputFocused, suggestions.length, showAddCustomValue, inputProps.disabled]
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

  const confirmCustomValue = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onAddCustomValue?.(trimmed);
    removeFocus();
  };

  const closeSuggestions = () => {
    setInputValue(value ? getSuggestionLabel(value) : '');
    removeFocus();
  };

  const totalItems = suggestions.length + (showAddCustomValue ? 1 : 0);
  const customValueIndex = showAddCustomValue ? suggestions.length : -1;

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    switch (e.key) {
      case 'ArrowDown': {
        setActiveSuggestionIndex((prev) => {
          const newIndex = prev < totalItems - 1 ? prev + 1 : prev;
          suggestionRefs.current[newIndex]?.scrollIntoView({ block: 'nearest' });
          return newIndex;
        });
        break;
      }
      case 'ArrowUp': {
        setActiveSuggestionIndex((prev) => {
          const newIndex = prev > 0 ? prev - 1 : prev;
          suggestionRefs.current[newIndex]?.scrollIntoView({ block: 'nearest' });
          return newIndex;
        });
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (activeSuggestionIndex === customValueIndex) {
          confirmCustomValue();
        } else if (activeSuggestionIndex >= 0) {
          selectSuggestion(activeSuggestionIndex);
        } else if (suggestions.length === 1) {
          selectSuggestion(0);
        }
        break;
      }
      case 'Tab': {
        if (activeSuggestionIndex === customValueIndex) {
          confirmCustomValue();
        } else if (activeSuggestionIndex >= 0) {
          selectSuggestion(activeSuggestionIndex);
        }
        break;
      }
      case 'Escape': {
        closeSuggestions();
        break;
      }
      default:
        break;
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

  useOutsideClick(
    showSuggestions ? wrapperRef : null, // Only trigger when the suggestions are displayed
    closeSuggestions
  );

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
          open: isInputFocused,
        }),
      },
    ];
  }, [
    inputProps.readOnly,
    inputProps.disabled,
    clearInput,
    value,
    small,
    focusInput,
    isInputFocused,
  ]);

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
          onMouseLeave={() => setActiveSuggestionIndex(-1)}
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
                'suggestion-item--custom': renderListElementComponent,
              })}
              onClick={() => selectSuggestion(index)}
              onMouseEnter={() => setActiveSuggestionIndex(index)}
            >
              {renderListElementComponent
                ? renderListElementComponent({
                    suggestion,
                    index,
                    isActive: index === activeSuggestionIndex,
                    isSelected:
                      !!value && getSuggestionLabel(value) === getSuggestionLabel(suggestion),
                  })
                : getSuggestionLabel(suggestion)}
            </li>
          ))}

          {showAddCustomValue && (
            <li
              ref={(el) => {
                suggestionRefs.current[suggestions.length] = el;
              }}
              className={cx('suggestion-item', 'suggestion-item--add-custom', {
                active: activeSuggestionIndex === customValueIndex,
                small,
              })}
              onClick={confirmCustomValue}
              onMouseEnter={() => setActiveSuggestionIndex(customValueIndex)}
              data-testid={testIdPrefix ? `${testIdPrefix}-add-custom` : undefined}
            >
              {addCustomValueLabel ?? `Add "${inputValue.trim()}"`}
            </li>
          )}

          {renderFooterItem && renderFooterItem()}
        </ul>
      )}
    </div>
  );
};

export default ComboBox;
