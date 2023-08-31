import React, { InputHTMLAttributes } from 'react';
import './CheckboxRadioSNCF.scss';
import cx from 'classnames';

/**
 * Simple checkbox or renderRadio
 * You HAVE TO use same name for all radio components that need to work together
 *
 * @component
 * @example
 * const id = 'number'
 * const label = 'string'
 * const name = 'string'
 * const type = 'string'
 * return (
 *  <CheckboxSNCF
 *    id={value}
 *    label={label}
 *    name={name}
 *    type={type}
 *    checked=bool
 *  />
 * )
 */

type CheckboxRadioSNCFProps = {
  id: string;
  label: React.ReactElement;
  name: string;
  checked: boolean;
  onChange: InputHTMLAttributes<HTMLInputElement>['onChange'];
  type: 'checkbox' | 'radio';
  disabled?: boolean;
};

const CheckboxRadioSNCF = ({
  id,
  label,
  name,
  checked = false,
  onChange,
  type = 'checkbox',
  disabled = false,
}: CheckboxRadioSNCFProps) => (
  <div className={cx('custom-control', `custom-${type}`)}>
    <input
      type={type}
      id={id}
      name={name}
      className="custom-control-input"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
    />
    <label
      className={cx('custom-control-label', type === 'radio' && 'font-weight-medium')}
      htmlFor={id}
    >
      {label}
    </label>
  </div>
);

export default CheckboxRadioSNCF;
