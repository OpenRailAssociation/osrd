import React from 'react';

import cx from 'classnames';

import useFocusByTab from '../../hooks/useFocusByTab';

export type RadioButtonProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> & {
  label: string;
  value: string;
  hint?: string;
  small?: boolean;
};

const RadioButton = ({
  id,
  label,
  value,
  hint,
  readOnly,
  onBlur,
  onKeyUp,
  small,
  ...rest
}: RadioButtonProps) => {
  const { handleKeyUp, handleBlur, isFocusByTab } = useFocusByTab({ onBlur, onKeyUp });
  return (
    <div className={cx('ui-radio-button', { 'read-only': readOnly, small })} tabIndex={0}>
      <div className="radio-container">
        <input
          className="radio-input"
          id={id || value}
          type="radio"
          value={value}
          tabIndex={-1}
          onBlur={handleBlur}
          onKeyUp={handleKeyUp}
          {...rest}
        />
        <span className={cx('checkmark', { focused: isFocusByTab })} />
        <label htmlFor={id || value} className="radio-label">
          {label}
        </label>
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
};

export default RadioButton;
