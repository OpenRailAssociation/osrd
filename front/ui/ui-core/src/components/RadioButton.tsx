import React, { type InputHTMLAttributes, type MouseEvent } from 'react';

import cx from 'classnames';

export type RadioButtonProps = React.PropsWithChildren<
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'children'> & {
    label: string;
    value: string;
    hint?: string;
    small?: boolean;
    ref?: React.RefObject<HTMLInputElement | null>;
  }
>;

const RadioButton = ({
  id,
  label,
  value,
  hint,
  readOnly,
  onClick,
  small,
  children,
  ref,
  ...rest
}: RadioButtonProps) => {
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
      className={cx('ui-radio-button', {
        small,
        'with-label': label || children,
        'with-hint': hint,
      })}
    >
      <input
        // Browsers' read-only attribute is not working on radio buttons. See: https://stackoverflow.com/a/70375659
        className={cx({ 'read-only': readOnly })}
        type="radio"
        id={id || value}
        value={value}
        onClick={handleClick}
        ref={ref}
        {...rest}
      />
      {label && <div className="radio-label">{label}</div>}
      {children && <div className="radio-label">{children}</div>}
      {hint && <div className="hint">{hint}</div>}
    </label>
  );
};

export default RadioButton;
