import React, { useMemo } from 'react';

import cx from 'classnames';

export type SegmentedControlProps<T> = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'checked'
> & {
  options: Array<T>;
  onChange: (option: T) => void;
  value: T;
  getOptionLabel: (option: T) => string;
  getOptionValue: (option: T) => string;
  getOptionIcon?: (option: T) => React.ReactNode;
  small?: boolean;
};

const SegmentedControl = <T,>({
  options,
  onChange,
  value,
  getOptionLabel,
  getOptionValue,
  getOptionIcon,
  small = false,
  ...inputProps
}: SegmentedControlProps<T>) => {
  const opts = useMemo(
    () =>
      options.map((e) => ({
        value: getOptionValue(e),
        label: getOptionLabel(e),
        icon: getOptionIcon ? getOptionIcon(e) : null,
        source: e,
      })),
    [options, getOptionValue, getOptionLabel, getOptionIcon]
  );
  return (
    <div className={cx('segmented-control', { small })}>
      {opts.map((option) => (
        <label
          key={option.value}
          className={cx(
            'segmented-control-option',
            option.value === getOptionValue(value) && 'checked'
          )}
          title={option.label}
          data-testid={`segmented-control-${option.value}`}
        >
          <div className="segmented-control-option-content">
            {option.icon ? option.icon : option.label}
          </div>
          <input
            {...inputProps}
            type="radio"
            checked={option.value === getOptionValue(value)}
            onChange={() => onChange(option.source)}
          />
        </label>
      ))}
    </div>
  );
};

export default SegmentedControl;
