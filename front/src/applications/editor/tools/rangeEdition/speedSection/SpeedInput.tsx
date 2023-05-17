import React, { FC, InputHTMLAttributes, useEffect, useState } from 'react';
import { isNumber } from 'lodash';
import { kmhToMs, msToKmh } from '../utils';

function msToKmhString(msSpeed: number | undefined): string {
  return isNumber(msSpeed) ? msToKmh(msSpeed).toFixed(2) : '';
}

const SpeedInput: FC<
  {
    msSpeed: number | undefined;
    onChange: (newMsSpeed: number | undefined) => void;
  } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>
> = ({ msSpeed, onChange, ...attrs }) => {
  const [kmhSpeed, setKmhSpeed] = useState<string>(msToKmhString(msSpeed));

  useEffect(() => {
    const newKmhSpeed = msToKmhString(msSpeed);
    if (+newKmhSpeed !== +kmhSpeed) setKmhSpeed(newKmhSpeed);
  }, [msSpeed]);

  return (
    <input
      min={0}
      step={0.1}
      {...attrs}
      type="number"
      value={kmhSpeed}
      onChange={(e) => {
        setKmhSpeed(e.target.value);
        const newKmhSpeed = +e.target.value;
        const newMsSpeed = isNumber(newKmhSpeed) ? kmhToMs(newKmhSpeed) : undefined;
        if (newMsSpeed !== msSpeed) onChange(newMsSpeed);
      }}
    />
  );
};

export default SpeedInput;
