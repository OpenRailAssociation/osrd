import React, { useEffect, useState } from 'react';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

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
  const [debouncedValue, setDebouncedValue] = useState<number | null>(null);

  useEffect(() => {
    setValue(input);
    setDebouncedValue(null);
  }, [input]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (value !== null && value !== input && min <= value && value <= max)
        setDebouncedValue(value);
      else if (value === null && input !== 0) setDebouncedValue(0);
    }, debouncedDelay);
    return () => {
      clearTimeout(handler);
    };
  }, [value]);

  useEffect(() => {
    if (debouncedValue !== null) {
      setInput(debouncedValue);
      setDebouncedValue(null);
    }
  }, [debouncedValue]);

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
