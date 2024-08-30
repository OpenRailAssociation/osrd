import React, { type InputHTMLAttributes, useEffect, useState } from 'react';

import { isNumber } from 'lodash';

import { kmhToMs, msToKmh } from 'utils/physics';

function msToKmhString(msSpeed: number | undefined): string {
  return isNumber(msSpeed) ? msToKmh(msSpeed).toFixed(2) : '';
}

type SpeedInputProps = {
  msSpeed: number | undefined;
  onChange: (newMsSpeed: number | undefined) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

const SpeedInput = ({ msSpeed, onChange, ...attrs }: SpeedInputProps) => {
  const [kmhSpeed, setKmhSpeed] = useState<string>(msToKmhString(msSpeed));

  useEffect(() => {
    const newKmhSpeed = msToKmhString(msSpeed);
    if (+newKmhSpeed !== +kmhSpeed) setKmhSpeed(newKmhSpeed);
  }, [msSpeed]);

  return (
    <input
      min={1}
      step={0.1}
      {...attrs}
      type="number"
      value={kmhSpeed}
      onChange={(e) => {
        const inputValue = e.target.value;
        setKmhSpeed(inputValue);
        const newKmhSpeed = parseFloat(inputValue);
        const newMsSpeed = Number.isNaN(newKmhSpeed) ? undefined : kmhToMs(newKmhSpeed);
        if (newMsSpeed !== msSpeed) onChange(newMsSpeed);
      }}
    />
  );
};

export default SpeedInput;
