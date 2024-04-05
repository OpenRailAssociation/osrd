import React, { useLayoutEffect, useRef } from 'react';

import cx from 'classnames';
import type { CellComponent, CellProps, Column } from 'react-datasheet-grid/dist/types';

const TimeComponent = ({
  focus,
  rowData,
  setRowData,
}: CellProps<string | null | undefined, string>) => {
  const ref = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (focus) {
      ref.current?.select();
    } else {
      ref.current?.blur();
    }
  }, [focus]);

  return (
    <input
      className={cx('dsg-input', !focus && 'dsg-hide-time-picker')}
      type="time"
      tabIndex={-1}
      ref={ref}
      style={{
        pointerEvents: focus ? 'auto' : 'none',
        opacity: rowData || focus ? undefined : 0,
      }}
      value={rowData ?? ''}
      onChange={(e) => {
        const time = e.target.value;
        setRowData(time);
      }}
    />
  );
};

TimeComponent.displayName = 'TimeComponent';

const timeColumn: Partial<Column<string | null | undefined, string, string>> = {
  component: TimeComponent as CellComponent<string | null | undefined, string>,
  deleteValue: () => null,
  copyValue: ({ rowData }) => rowData ?? null,
  pasteValue: ({ value }) => value,
  minWidth: 170,
  isCellEmpty: ({ rowData }) => !rowData,
};

export default timeColumn;
