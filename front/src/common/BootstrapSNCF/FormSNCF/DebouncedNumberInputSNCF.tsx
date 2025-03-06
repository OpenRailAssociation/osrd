import React, { useEffect, useState } from 'react';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebouncedFunc } from 'utils/helpers';

type DebouncedNumberInputSNCFProps = {
  input: number;
  label: string;
  onChange: (inputValue: number) => void;
  debouncedDelay?: number;
  id?: string;
  max?: number;
  min?: number;
  sm?: boolean;
  showFlex?: boolean;
};

const DebouncedNumberInputSNCF = ({
  input,
  label,
  onChange,
  debouncedDelay = 1000,
  id = '',
  max,
  min = 0,
  sm = false,
  showFlex = false,
}: DebouncedNumberInputSNCFProps) => {
  const [value, setValue] = useState<number | null>(input);

  useEffect(() => {
    setValue(input);
  }, [input]);

  const checkChangedInput = (newValue: number | null) => {
    if (
      newValue !== null &&
      newValue !== input &&
      min <= newValue &&
      (max === undefined || newValue <= max)
    ) {
      onChange(newValue);
    } else if (value === null && input !== 0) {
      const previousValue = input;
      onChange(previousValue);
    }
  };

  useDebouncedFunc(value, debouncedDelay, checkChangedInput);

  return (
    <div className={`${showFlex && 'debounced-number-input'}`}>
      <InputSNCF
        type="number"
        id={id}
        isInvalid={value !== null && (value < min || (max !== undefined && max < value))}
        label={label}
        max={max}
        min={min}
        noMargin
        onChange={(e) => {
          setValue(e.target.value !== '' ? parseFloat(e.target.value) : null);
        }}
        value={value !== null ? value : ''}
        sm={sm}
      />
    </div>
  );
};

export default React.memo(DebouncedNumberInputSNCF);
