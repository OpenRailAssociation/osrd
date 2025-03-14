import React, { useState } from 'react';

import cx from 'classnames';

import FieldWrapper, { type FieldWrapperProps } from './FieldWrapper';
import useFocusByTab from '../../hooks/useFocusByTab';

export type TextAreaProps = React.InputHTMLAttributes<HTMLTextAreaElement> &
  Omit<FieldWrapperProps, 'children'>;

const CHAR_COUNT_ERROR_THRESHOLD = 40;
const TextArea = ({
  id,
  label,
  value: initialValue,
  hint,
  required,
  disabled,
  statusWithMessage,
  maxLength,
  onChange,
  onKeyUp,
  onBlur,
  ...rest
}: TextAreaProps) => {
  const [value, setValue] = useState<string>(initialValue as string);
  const charCount = value?.length || 0;
  const { handleKeyUp, handleBlur, isFocusByTab } = useFocusByTab({ onBlur, onKeyUp });

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    onChange?.(e);
  };

  return (
    <FieldWrapper
      id={id}
      label={label}
      hint={hint}
      statusWithMessage={statusWithMessage}
      disabled={disabled}
      required={required}
      className="text-area-field-wrapper"
    >
      <div className={cx('text-area-wrapper', { 'focused-by-tab': isFocusByTab })}>
        {maxLength && (
          <div
            className={cx('char-count', {
              error: charCount === maxLength,
              warning: maxLength - charCount <= CHAR_COUNT_ERROR_THRESHOLD,
            })}
          >
            {charCount}/{maxLength}
          </div>
        )}
        <textarea
          className={cx('text-area', { [statusWithMessage?.status || '']: !!statusWithMessage })}
          id={id}
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyUp={handleKeyUp}
          {...rest}
        />
      </div>
    </FieldWrapper>
  );
};

export default TextArea;
