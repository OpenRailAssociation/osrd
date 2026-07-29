import React, { type InputHTMLAttributes } from 'react';

import cx from 'classnames';

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  dataTestId?: string;
};

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, size, id: providedId, dataTestId, ...rest }, ref) => {
    const generatedId = React.useId();
    const id = providedId ?? generatedId;

    return (
      <label
        className={cx('ui-switch', { [`size-${size}`]: size, 'with-label': !!label })}
        htmlFor={id}
      >
        <input ref={ref} id={id} type="checkbox" data-testid={dataTestId} {...rest} />
        {label && <div className="label">{label}</div>}
      </label>
    );
  }
);

Switch.displayName = 'Switch';
export default Switch;
