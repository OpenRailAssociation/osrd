import { useRef, useState, useEffect } from 'react';

import type { CellProps } from '@sdziadkowiec/react-datasheet-grid/dist/types';
import { useTranslation } from 'react-i18next';

import type { TimeExtraDays } from './types';

type TimeInputProps = CellProps<TimeExtraDays | undefined, string>;

const TimeInput = ({ focus, rowData, active, setRowData }: TimeInputProps) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);
  const [tempTimeValue, setTempTimeValue] = useState<TimeExtraDays | undefined>(rowData);

  useEffect(() => {
    if (active) {
      ref.current?.select();
    } else {
      ref.current?.blur();
    }
  }, [active]);

  // Allow us to update the field when the change comes from outside of the input
  // In this use case, we use it when the user updates the start time to update
  // the arrival time for the origin which should match the departure time
  useEffect(() => {
    setTempTimeValue(rowData);
  }, [rowData]);

  const input = (
    <input
      // className from react-datasheet-grid library
      className="dsg-input"
      type="time"
      tabIndex={-1}
      ref={ref}
      step={1}
      style={{
        pointerEvents: focus ? 'auto' : 'none',
        opacity: rowData || active ? undefined : 0,
      }}
      value={tempTimeValue?.time ?? ''}
      onChange={(e) => {
        setTempTimeValue((prev) => ({ ...prev, time: e.target.value }));
      }}
      onBlur={() => {
        // To prevent the operational point to be transformed into a via if we leave the cell empty after focusing it
        if (rowData !== tempTimeValue) {
          setRowData(tempTimeValue);
        }
      }}
    />
  );

  return (
    <div className="time-input-container">
      {input}
      {!!tempTimeValue?.daySinceDeparture &&
        tempTimeValue.dayDisplayed &&
        t('timeStopTable.dayCounter', { count: tempTimeValue.daySinceDeparture })}
    </div>
  );
};

export default TimeInput;
