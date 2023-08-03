import React, { useEffect, useState } from 'react';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebouncedFunc } from 'utils/helpers';

type DebouncedNumberInputSNCFProps = {
  input: number;
  label: string;
  setInput: (inputValue: number) => void;
  debouncedDelay?: number;
  id?: string;
  max?: number;
  min?: number;
};

const DebouncedNumberInputSNCF = ({
  input,
  label,
  setInput,
  debouncedDelay = 800,
  id = '',
  max = 100,
  min = 0,
}: DebouncedNumberInputSNCFProps) => {
  const [value, setValue] = useState<number | null>(input);

  useEffect(() => {
    setValue(input);
  }, [input]);

  const checkChangedInput = (newValue: number) => {
    if (newValue !== null && newValue !== input && min <= newValue && newValue <= max)
      setInput(newValue);
    else if (value === null && input !== 0) setInput(0);
  };

  useDebouncedFunc(value, debouncedDelay, checkChangedInput);

  return (
    <InputSNCF
      type="number"
      id={id}
      label={label}
      onChange={(e) => {
        setValue(e.target.value !== '' ? parseFloat(e.target.value) : null);
      }}
      max={max}
      min={min}
      value={value !== null ? value : ''}
      isInvalid={value !== null && (value < min || max < value)}
      isFlex
      noMargin
      sm
    />
  );
};

export default React.memo(DebouncedNumberInputSNCF);
