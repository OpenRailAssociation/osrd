import React, { useState, useRef, useCallback } from 'react';

import cx from 'classnames';

import Input, { type InputProps } from './Input';
import InputModal from '../Modal';

export type TimePickerProps = Omit<
  InputProps,
  'type' | 'name' | 'value' | 'onClick' | 'onChange' | 'ref' | 'step'
> & {
  hours?: number;
  minutes?: number;
  seconds?: number;
  displaySeconds?: boolean;
  onTimeChange: ({
    hours,
    minutes,
    seconds,
  }: {
    hours: number;
    minutes: number;
    seconds?: number;
  }) => void;
  testIdPrefix?: string;
};

type TimeRangeProps = {
  range: number[];
  selectedItem: number;
  className: string;
  onSelectItem: (item: number) => void;
};

const TimeRange = ({ range, selectedItem, className, onSelectItem }: TimeRangeProps) => (
  <div className="time-grid">
    {range.map((item) => (
      <div
        key={item}
        className={cx(className, { selected: selectedItem === item })}
        onClick={() => onSelectItem(item)}
      >
        {item.toString().padStart(2, '0')}
      </div>
    ))}
  </div>
);

function formatTimeValue(value: number, max: number) {
  return Math.max(0, Math.min(max, value)).toString().padStart(2, '0');
}

const TimePicker = ({
  onTimeChange,
  hours = 0,
  minutes = 0,
  seconds = 0,
  displaySeconds = false,
  testIdPrefix,
  ...otherProps
}: TimePickerProps) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const incrementMinute = useCallback(
    (increment: number) => {
      let newMinutes = minutes + increment;
      let newHours = hours;

      if (newMinutes >= 60) {
        newMinutes = 0;
        newHours = (newHours + 1) % 24;
      } else if (newMinutes < 0) {
        newMinutes = 59;
        newHours = (newHours + 23) % 24; // minus 1 hour
      }
      onTimeChange({ hours: newHours, minutes: newMinutes, seconds });
    },
    [hours, minutes, seconds, onTimeChange]
  );

  const incrementSeconds = useCallback(
    (increment: number) => {
      let newSeconds = seconds + increment;
      let newMinutes = minutes;
      let newHours = hours;

      if (newSeconds >= 60) {
        newSeconds = 0;
        newMinutes += 1;

        if (newMinutes >= 60) {
          newMinutes = 0;
          newHours = (newHours + 1) % 24;
        }
      } else if (newSeconds < 0) {
        newSeconds = 59;
        newMinutes -= 1;

        if (newMinutes < 0) {
          newMinutes = 59;
          newHours = (newHours + 23) % 24; // minus 1 hour
        }
      }
      onTimeChange({ hours: newHours, minutes: newMinutes, seconds: newSeconds });
    },
    [hours, minutes, seconds, onTimeChange]
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (!displaySeconds) {
        const [h, m] = value.split(':');
        if (h !== undefined && m !== undefined) {
          onTimeChange({ hours: parseInt(h), minutes: parseInt(m) });
        }
      } else {
        const [h, m, s] = value.split(':');
        if (h !== undefined && m !== undefined && s !== undefined) {
          onTimeChange({ hours: parseInt(h), minutes: parseInt(m), seconds: parseInt(s) });
        }
      }
    },
    [displaySeconds, onTimeChange]
  );

  const displayedSecondsPart = displaySeconds ? `:${formatTimeValue(seconds, 59)}` : '';
  const selectedTime = `${formatTimeValue(hours, 23)}:${formatTimeValue(minutes, 59)}${displayedSecondsPart}`;
  const hoursRange = [...Array(24).keys()];
  const minutesAndSecondsRange = [...Array(12).keys()].map((i) => i * 5);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  return (
    <div data-testid={testIdPrefix ? `${testIdPrefix}` : undefined} className="ui-time-picker">
      <Input
        testIdPrefix={testIdPrefix ? `${testIdPrefix}` : undefined}
        {...otherProps}
        className={cx('input', 'time-input', otherProps.className)}
        type="time"
        name="time"
        value={selectedTime}
        onClick={openModal}
        onChange={handleChange}
        ref={inputRef}
        step={displaySeconds ? 1 : 60}
      />
      <InputModal
        inputRef={inputRef}
        isOpen={isModalOpen}
        onClose={closeModal}
        testIdPrefix={testIdPrefix ? `${testIdPrefix}-modal` : undefined}
      >
        <div className="time-picker-container">
          <TimeRange
            range={hoursRange}
            selectedItem={hours}
            className="hour"
            onSelectItem={(h) => onTimeChange({ hours: h, minutes, seconds })}
          />

          <div className="time-separator">:</div>

          <div className="minute-container">
            <TimeRange
              range={minutesAndSecondsRange}
              selectedItem={minutes}
              className="minute"
              onSelectItem={(m) => onTimeChange({ hours, minutes: m, seconds })}
            />
            <div className="minute-buttons">
              <button
                data-testid={testIdPrefix ? `${testIdPrefix}-decrement-minute` : undefined}
                onClick={() => incrementMinute(-1)}
                className="minute-button"
              >
                -1mn
              </button>
              <button
                data-testid={testIdPrefix ? `${testIdPrefix}-increment-minute` : undefined}
                onClick={() => incrementMinute(1)}
                className="minute-button"
              >
                +1mn
              </button>
            </div>
          </div>
          {displaySeconds && (
            <>
              <div className="time-separator">:</div>
              <div className="second-container">
                <TimeRange
                  range={minutesAndSecondsRange}
                  selectedItem={seconds}
                  className="second"
                  onSelectItem={(s) => onTimeChange({ hours, minutes, seconds: s })}
                />
                <div className="second-buttons">
                  <button onClick={() => incrementSeconds(-1)} className="second-button">
                    -1s
                  </button>
                  <button onClick={() => incrementSeconds(1)} className="second-button">
                    +1s
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </InputModal>
    </div>
  );
};

export default TimePicker;
