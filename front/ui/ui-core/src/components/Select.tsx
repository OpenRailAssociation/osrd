import React, { useCallback, useEffect, useState } from 'react';

import cx from 'classnames';

import FieldWrapper, { type FieldWrapperProps } from './inputs/FieldWrapper';
import useFocusByTab from '../hooks/useFocusByTab';

export type SelectProps<T> = Omit<
  React.InputHTMLAttributes<HTMLSelectElement>,
  'value' | 'onChange'
> &
  Omit<FieldWrapperProps, 'children'> & {
    options: Array<T>;
    value?: T;
    getOptionLabel: (option: T) => string;
    getOptionValue: (option: T) => string;
    onChange: (option?: T) => void;
  };

const PLACEHOLDER_VALUE = '__PLACEHOLDER__';

const Select = <T,>({
  id,
  label,
  hint,
  value,
  options,
  placeholder,
  statusWithMessage,
  required,
  disabled,
  narrow,
  readOnly,
  small,
  getOptionLabel,
  getOptionValue,
  onChange,
  onBlur,
  onKeyUp,
  ...props
}: SelectProps<T>) => {
  const [selectedOption, setSelectedOption] = useState<T | undefined>(value);
  const { handleKeyUp, handleBlur, isFocusByTab } = useFocusByTab({ onBlur, onKeyUp });
  console.log('focus on tab', isFocusByTab);

  const handleOnChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newSelectedOption =
        e.target.value === PLACEHOLDER_VALUE
          ? undefined
          : options.find((option) => getOptionValue(option) === e.target.value);
      setSelectedOption(newSelectedOption);
      onChange(newSelectedOption);
    },
    [options, getOptionValue, onChange]
  );

  useEffect(() => {
    setSelectedOption(value);
  }, [value]);

  return (
    <FieldWrapper
      id={id}
      label={label}
      hint={hint}
      statusWithMessage={statusWithMessage}
      required={required}
      disabled={disabled}
      small={small}
      narrow={narrow}
      className={cx('ui-input-field-wrapper')}
    >
      <select
        id={id}
        className={cx(
          'ui-select',
          statusWithMessage?.status,
          {
            'placeholder-selected': placeholder && !selectedOption,
            small,
            'read-only': readOnly,
          },
          isFocusByTab && 'focused-by-tab'
        )}
        value={selectedOption ? getOptionValue(selectedOption) : undefined}
        required={required}
        disabled={disabled || readOnly}
        onKeyUp={handleKeyUp}
        onBlur={handleBlur}
        onChange={handleOnChange}
        {...props}
      >
        {placeholder && (
          <option
            value={PLACEHOLDER_VALUE}
            className="placeholder-option"
          >{`– ${placeholder} –`}</option>
        )}
        {options.map((option) => (
          <option key={getOptionValue(option)} value={getOptionValue(option)}>
            {getOptionLabel(option)}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
};

export default Select;
