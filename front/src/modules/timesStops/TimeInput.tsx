import { useRef, useState, useEffect } from 'react';

import type { CellProps } from 'react-datasheet-grid/dist/types';

const TimeInput = ({
  focus,
  rowData,
  active,
  setRowData,
}: CellProps<string | null | undefined, string>) => {
  const ref = useRef<HTMLInputElement>(null);
  const [tempTimeValue, setTempTimeValue] = useState<string | null | undefined>(rowData);

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

  return (
    <input
      className="dsg-input"
      type="time"
      tabIndex={-1}
      ref={ref}
      step={2}
      style={{
        pointerEvents: focus ? 'auto' : 'none',
        opacity: rowData || active ? undefined : 0,
      }}
      value={tempTimeValue ?? ''}
      onChange={(e) => {
        setTempTimeValue(e.target.value);
      }}
      onBlur={() => {
        // To prevent the operational point to be transformed into a via if we leave the cell empty after focusing it
        if (rowData !== tempTimeValue) {
          setRowData(tempTimeValue);
        }
      }}
    />
  );
};

TimeInput.displayName = 'TimeInput';

export default TimeInput;
