import React, { type ReactNode } from 'react';

import cx from 'classnames';
import { isString } from 'lodash';

export interface SelectOptionObject {
  id?: string;
  label: string;
}

export function getOptionValue(option: string | SelectOptionObject): string {
  return isString(option) ? option : option.id || option.label;
}

export function getOptionLabel(option: string | SelectOptionObject): string {
  return isString(option) ? option : option.label;
}
interface SelectProps<T> {
  id: string;
  label?: ReactNode;
  name?: string;
  value?: T;
  options: Array<T>;
  onChange: (e?: T) => void;
  className?: string;
  sm?: boolean;
  disabled?: boolean;
}

function SelectSNCF<T extends string | SelectOptionObject>({
  id,
  label,
  name,
  options,
  onChange,
  className,
  sm,
  value,
  disabled,
}: SelectProps<T>) {
  return (
    <>
      {label && <label htmlFor={id}>{label}</label>}
      <select
        id={id}
        name={name}
        onChange={(e) => {
          const selected = e.target.value;
          const item = options.find((o) => selected === (isString(o) ? o : o.id));
          onChange(item);
        }}
        className={cx(className, sm && 'sm')}
        value={isString(value) ? value : value?.id}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={getOptionValue(option)} value={getOptionValue(option)}>
            {getOptionLabel(option)}
          </option>
        ))}
      </select>
    </>
  );
}

export default SelectSNCF;
