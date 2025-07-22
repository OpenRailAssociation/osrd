import { type ReactNode, type InputHTMLAttributes } from 'react';

import cx from 'classnames';

/*
 * Simple checkbox or renderRadio
 * You HAVE TO use same name for all radio components that need to work together
 */

type CheckboxRadioProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  containerClassName?: string;
};

const CheckboxInput = (props: CheckboxRadioProps) => {
  const { id, label, className, containerClassName, title, ...inputProps } = props;
  return (
    <div className={`custom-control custom-checkbox ${containerClassName}`} title={title}>
      <input
        {...inputProps}
        id={id}
        data-testid={`${id}-checkbox`}
        className={cx(className, 'custom-control-input')}
        type="checkbox"
      />
      <label className="custom-control-label" htmlFor={id}>
        {label}
      </label>
    </div>
  );
};

const RadioInput = (props: CheckboxRadioProps) => {
  const { id, label, className, containerClassName, title, ...inputProps } = props;
  return (
    <div className={`custom-control custom-radio ${containerClassName}`} title={title}>
      <input
        {...inputProps}
        id={id}
        data-testid={`${id}-radio`}
        className={cx(className, 'custom-control-input')}
        type="radio"
      />
      <label className="custom-control-label font-weight-medium" htmlFor={id}>
        {label}
      </label>
    </div>
  );
};

const CheckboxRadioSNCF = (props: CheckboxRadioProps & { type: 'radio' | 'checkbox' }) => {
  const { type } = props;
  return type === 'radio' ? <RadioInput {...props} /> : <CheckboxInput {...props} />;
};

export default CheckboxRadioSNCF;
