import React, { useEffect, useState } from 'react';

import cx from 'classnames';

import FieldWrapper, { type FieldWrapperProps } from './inputs/FieldWrapper';

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
  ...props
}: SelectProps<T>) => {
  const [selectedOption, setSelectedOption] = useState<T | undefined>(value);
  const handleOnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSelectedOption =
      e.target.value === PLACEHOLDER_VALUE
        ? undefined
        : options.find((option) => getOptionValue(option) === e.target.value);
    setSelectedOption(newSelectedOption);
    onChange(newSelectedOption);
  };

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
    >
      <select
        id={id}
        className={cx('ui-select', statusWithMessage?.status, {
          'placeholder-selected': placeholder && !selectedOption,
          small,
          'read-only': readOnly,
        })}
        value={selectedOption ? getOptionValue(selectedOption) : undefined}
        required={required}
        disabled={disabled || readOnly}
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
