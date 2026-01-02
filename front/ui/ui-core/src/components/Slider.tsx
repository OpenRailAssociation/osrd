import React, { useEffect, useState } from 'react';
import type { ChangeEvent, MouseEvent, KeyboardEvent, InputHTMLAttributes } from 'react';

import cx from 'classnames';

export type SliderProps = InputHTMLAttributes<HTMLInputElement> & {
  width?: number;
  onChangeCommitted?: (e: MouseEvent<HTMLInputElement> | KeyboardEvent<HTMLInputElement>) => void;
  containerClassName?: string;
};

// onChange returns an event or number
const Slider = ({
  id,
  value: initialValue,
  min = 0,
  max = 100,
  step = 1,
  width = 112,
  onChange,
  onChangeCommitted,
  disabled,
  className,
  containerClassName,
  ...rest
}: SliderProps) => {
  const [value, setValue] = useState<number>(
    initialValue !== undefined ? Number(initialValue) : Number(min)
  );

  useEffect(() => {
    setValue(Number(initialValue));
  }, [initialValue]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    setValue(newValue);
    onChange?.(e);
  };

  const handleCommit = (e: MouseEvent<HTMLInputElement> | KeyboardEvent<HTMLInputElement>) => {
    if (onChangeCommitted) {
      onChangeCommitted(e);
    }
  };

  // margin to keep the colored track aligned with the thumb
  const visualMargin = 5;
  const visualMin = Number(min) - visualMargin;
  const visualMax = Number(max) + visualMargin;
  const visualProgress = ((value - visualMin) / (visualMax - visualMin)) * 100;

  return (
    <div
      className={cx('ui-range-wrapper', containerClassName, { disabled })}
      style={{ width: `${width}px` }}
    >
      <input
        data-testid="range-slider"
        type="range"
        className={cx('range-slider', className)}
        id={id}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={handleChange}
        onMouseUp={handleCommit}
        onKeyUp={handleCommit}
        disabled={disabled}
        style={
          {
            '--slider-progress': `${visualProgress}%`,
          } as React.CSSProperties
        }
        {...rest}
      />
    </div>
  );
};

export default Slider;
