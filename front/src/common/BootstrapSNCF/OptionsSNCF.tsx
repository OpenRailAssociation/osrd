/* Usage
 * <OptionsSNCF
 * onChange=function
 * name=string
 * selectedValue=string
 * options={[{ value: string, label: string}, { value: string, label: string}]} />
 */

import React, { ChangeEventHandler } from 'react';
import './OptionsSNCF.scss';

type Option = {
  label: string | React.ReactElement;
  value: string | number;
};

type Props = {
  onChange: ChangeEventHandler<HTMLInputElement>;
  options: Option[];
  name: string;
  selectedValue: string;
  label?: string | React.ReactElement;
  sm?: boolean;
};

export default function OptionsSNCF({
  onChange,
  options,
  name,
  selectedValue,
  sm = false,
  label,
}: Props) {
  return (
    <>
      {label && <label htmlFor={name}>{label}</label>}
      <div className={`options-control ${sm ? 'sm' : ''}`} id={name}>
        {options.map((option) => (
          <div className="options-item" key={option.value}>
            <input
              type="radio"
              name={name}
              id={`${name}${option.value}`}
              onChange={onChange}
              className="sr-only"
              value={option.value}
              checked={selectedValue === option.value}
            />
            <label className="options-btn font-weight-medium" htmlFor={`${name}${option.value}`}>
              {option.label}
            </label>
          </div>
        ))}
      </div>
    </>
  );
}
