import React, { type InputHTMLAttributes, type MouseEvent } from 'react';

import cx from 'classnames';

export type CheckboxProps = React.PropsWithChildren<
  Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> & {
    label?: string;
    small?: boolean;
    hint?: string;
    isIndeterminate?: boolean;
  }
>;

const Checkbox = ({
  label,
  small,
  hint,
  disabled,
  checked,
  readOnly,
  isIndeterminate = false,
  onClick,
  children,
  ...rest
}: CheckboxProps) => {
  const handleClick = (e: MouseEvent<HTMLInputElement>) => {
    if (readOnly) {
      e.preventDefault();
      e.stopPropagation();
    } else {
      onClick?.(e);
    }
  };
  return (
    <label
      className={cx('ui-checkbox', { small, 'with-label': label || children, 'with-hint': hint })}
    >
      <input
        // Browsers' read-only attribute is not working on checkboxes. See: https://stackoverflow.com/a/70375659
        className={cx({ 'read-only': readOnly })}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        ref={(input) => {
          if (input) {
            input.indeterminate = isIndeterminate;
          }
        }}
        onClick={handleClick}
        {...rest}
      />
      {label && <div className="label">{label}</div>}
      {children && <div className="label">{children}</div>}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
};

export default Checkbox;
