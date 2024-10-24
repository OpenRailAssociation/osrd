import cx from 'classnames';
import { DynamicDataSheetGrid, type DataSheetGridProps } from 'react-datasheet-grid';
import type { Operation } from 'react-datasheet-grid/dist/types';
import { useTranslation } from 'react-i18next';

import { useTimeStopsColumns } from './hooks/useTimeStopsColumns';
import { type TableType, type TimeStopsRow } from './types';

type TimesStopsProps<T extends TimeStopsRow> = {
  rows: T[];
  tableType: TableType;
  cellClassName?: DataSheetGridProps['cellClassName'];
  stickyRightColumn?: DataSheetGridProps['stickyRightColumn'];
  headerRowHeight?: number;
  onChange?: (newRows: T[], operation: Operation) => void;
};

const TimesStops = <T extends TimeStopsRow>({
  rows,
  tableType,
  cellClassName,
  stickyRightColumn,
  headerRowHeight,
  onChange,
}: TimesStopsProps<T>) => {
  const { t } = useTranslation('timesStops');

  const columns = useTimeStopsColumns(tableType, rows);

  if (!rows) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <p className="pt-1 px-5">{t('noPathLoaded')}</p>
      </div>
    );
  }

  return (
    <DynamicDataSheetGrid
      className="time-stops-datasheet"
      columns={columns}
      value={rows}
      onChange={(newRows: T[], [op]) => {
        if (onChange) {
          onChange(newRows, op);
        }
      }}
      stickyRightColumn={stickyRightColumn}
      lockRows
      height={600}
      headerRowHeight={headerRowHeight}
      rowClassName={({ rowData, rowIndex }) =>
        cx({
          activeRow: rowData.isWaypoint,
          oddRow: (rowIndex + 1) % 2,
        })
      }
      cellClassName={cellClassName}
    />
  );
};

export default TimesStops;
