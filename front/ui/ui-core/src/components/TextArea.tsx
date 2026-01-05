import React from 'react';

import cx from 'classnames';

import FieldWrapper, { type FieldWrapperProps } from './FieldWrapper';
import useFocusByTab from '../hooks/useFocusByTab';

export type TextAreaProps = React.InputHTMLAttributes<HTMLTextAreaElement> &
  Omit<FieldWrapperProps, 'children'>;

const CHAR_COUNT_ERROR_THRESHOLD = 40;
const TextArea = ({
  id,
  label,
  value = '',
  hint,
  disabled,
  maxLength,
  wrapperProps,
  onChange,
  onKeyUp,
  onBlur,
  ...rest
}: TextAreaProps) => {
  const charCount = (value as string)?.length || 0;
  const { handleKeyUp, handleBlur, isFocusByTab } = useFocusByTab({ onBlur, onKeyUp });

  return (
    <FieldWrapper
      id={id}
      label={label}
      hint={hint}
      disabled={disabled}
      wrapperProps={wrapperProps}
      className="ui-text-area-field-wrapper"
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
          className={cx(
            'text-area',
            wrapperProps?.withWrapper && wrapperProps.statusWithMessage?.status
          )}
          id={id}
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          onChange={onChange}
          onBlur={handleBlur}
          onKeyUp={handleKeyUp}
          {...rest}
        />
      </div>
    </FieldWrapper>
  );
};

export default TextArea;
