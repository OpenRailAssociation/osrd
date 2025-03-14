import React, { type InputHTMLAttributes, type MouseEvent } from 'react';

import cx from 'classnames';

import useFocusByTab from '../../../hooks/useFocusByTab';

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  small?: boolean;
  hint?: string;
  isIndeterminate?: boolean;
};

const Checkbox = ({
  label,
  small,
  hint,
  disabled,
  checked,
  readOnly,
  isIndeterminate = false,
  onClick,
  onKeyUp,
  onBlur,
  ...rest
}: CheckboxProps) => {
  const { handleKeyUp, handleBlur, isFocusByTab } = useFocusByTab({ onBlur, onKeyUp });

  const handleClick = (e: MouseEvent<HTMLInputElement>) => {
    if (readOnly) {
      e.preventDefault();
      e.stopPropagation();
    } else {
      onClick?.(e);
    }
  };
  return (
    <label className={cx('custom-checkbox', { small })}>
      <input
        //read-only state is not working on checkbox as well explain here : https://stackoverflow.com/a/70375659
        className={cx({ 'read-only': readOnly })}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        ref={(input) => input && (input.indeterminate = isIndeterminate)}
        onClick={handleClick}
        onBlur={handleBlur}
        onKeyUp={handleKeyUp}
        {...rest}
      />
      <span className={cx('checkmark', { 'focused-by-tab': isFocusByTab })}></span>
      {label && <div className="label">{label}</div>}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
};

export default Checkbox;
