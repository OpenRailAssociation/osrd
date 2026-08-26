import React, { useState, useRef, useEffect, useCallback } from 'react';

import Input, { type InputProps } from '../Input';
import Popover from '../InputPopover';
import { type StatusWithMessage } from '../StatusMessage';
import { TOLERANCE_RANGES } from './consts';
import ToleranceRangeGrid from './ToleranceRangeGrid';

const DEFAULT_TOLERANCE_VALUES = {
  minusTolerance: TOLERANCE_RANGES[0].value,
  plusTolerance: TOLERANCE_RANGES[0].value,
};

export type ToleranceValues = {
  minusTolerance: number;
  plusTolerance: number;
};

export type TolerancePickerProps = Omit<InputProps, 'value'> & {
  onToleranceChange: (toleranceValues: ToleranceValues) => void;
  toleranceValues?: ToleranceValues;
  translateWarningMessage?: (invalidTolerance: number) => string;
  testIdPrefix?: string;
};

const TolerancePicker = ({
  onToleranceChange,
  toleranceValues: { minusTolerance, plusTolerance } = DEFAULT_TOLERANCE_VALUES,
  translateWarningMessage,
  testIdPrefix,
  ...inputProps
}: TolerancePickerProps) => {
  const formatToleranceValue = useCallback(
    (minusIndex: number, plusIndex: number) =>
      `-${TOLERANCE_RANGES[minusIndex]?.label || ''}/+${TOLERANCE_RANGES[plusIndex]?.label || ''}`,
    []
  );

  const [showPicker, setShowPicker] = useState(false);
  const [inputValue, setInputValue] = useState(formatToleranceValue(0, 0));
  const [warningStatus, setWarningStatus] = useState<StatusWithMessage | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const minusToleranceIndex = TOLERANCE_RANGES.findIndex(
      (range) => range.value === minusTolerance
    );
    const plusToleranceIndex = TOLERANCE_RANGES.findIndex((range) => range.value === plusTolerance);
    if (minusToleranceIndex < 0 || plusToleranceIndex < 0) {
      const invalidTolerance = minusToleranceIndex < 0 ? minusTolerance : plusTolerance;

      /* eslint-disable-next-line react/set-state-in-effect */
      setWarningStatus({
        status: 'warning',
        message:
          translateWarningMessage?.(invalidTolerance) ||
          `${invalidTolerance} is not a valid tolerance value.`,
      });
    } else {
      setWarningStatus(undefined);
    }

    setInputValue(formatToleranceValue(minusToleranceIndex, plusToleranceIndex));
  }, [formatToleranceValue, minusTolerance, plusTolerance, translateWarningMessage]);

  return (
    <div data-testid={testIdPrefix ? `${testIdPrefix}` : undefined} className="ui-tolerance-picker">
      <div>
        <Input
          testIdPrefix={testIdPrefix}
          {...inputProps}
          value={inputValue}
          statusWithMessage={warningStatus}
          onClick={() => setShowPicker(!showPicker)}
          type="text"
          ref={inputRef}
        />
      </div>

      <Popover
        testIdPrefix="modal"
        inputRef={inputRef}
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
      >
        <div className="time-tolerance">
          <ToleranceRangeGrid
            onSelection={(e) => onToleranceChange({ minusTolerance: e, plusTolerance })}
            selectedTolerance={minusTolerance}
            toleranceSign="minus"
          />

          <div className="divider" />

          <ToleranceRangeGrid
            onSelection={(e) => onToleranceChange({ minusTolerance, plusTolerance: e })}
            selectedTolerance={plusTolerance}
            toleranceSign="plus"
          />
        </div>
      </Popover>
    </div>
  );
};

export default TolerancePicker;
