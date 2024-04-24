import React, { type FC, type ReactNode, type InputHTMLAttributes } from 'react';

import cx from 'classnames';

/*
 * Simple checkbox or renderRadio
 * You HAVE TO use same name for all radio components that need to work together
 */

type CheckboxRadioProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  containerClassName?: string;
};

const CheckboxInput: FC<CheckboxRadioProps> = (props) => {
  const { id, label, className, containerClassName, ...inputProps } = props;
  return (
    <div className={`custom-control custom-checkbox ${containerClassName}`}>
      <input
        {...inputProps}
        id={id}
        className={cx(className, 'custom-control-input')}
        type="checkbox"
      />
      <label className="custom-control-label" htmlFor={id}>
        {label}
      </label>
    </div>
  );
};

const RadioInput: FC<CheckboxRadioProps> = (props) => {
  const { id, label, className, containerClassName, ...inputProps } = props;
  return (
    <div className={`custom-control custom-radio ${containerClassName}`}>
      <input
        {...inputProps}
        id={id}
        className={cx(className, 'custom-control-input')}
        type="radio"
      />
      <label className="custom-control-label font-weight-medium" htmlFor={id}>
        {label}
      </label>
    </div>
  );
};

const CheckboxRadioSNCF: FC<CheckboxRadioProps & { type: 'radio' | 'checkbox' }> = (props) => {
  const { type } = props;
  return type === 'radio' ? <RadioInput {...props} /> : <CheckboxInput {...props} />;
};

export default CheckboxRadioSNCF;
