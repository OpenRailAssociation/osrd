import React, { useEffect, useState } from 'react';

import cx from 'classnames';
import { DynamicDataSheetGrid, type DataSheetGridProps } from 'react-datasheet-grid';
import { useTranslation } from 'react-i18next';

import { useTimeStopsColumns } from './hooks/useTimeStopsColumns';
import { TableType } from './types';
import type { Operation } from 'react-datasheet-grid/dist/types';

export const WITH_KP = true;

export type TimeStopsRow = {
  opId: string;
  name?: string;
  ch?: string;
  isVia?: boolean;

  arrival?: string | null; // value asked by user
  departure?: string | null; // value asked by user
  stopFor?: string | null; // value asked by user
  onStopSignal?: boolean;
  theoreticalMargin?: string; // value asked by user

  theoreticalMarginSeconds?: string;
  calculatedMargin?: string;
  diffMargins?: string;
  calculatedArrival?: string | null;
  calculatedDeparture?: string | null;

  isMarginValid?: boolean;
};

type TimesStopsProps<T> = {
  allWaypoints?: T[];
  tableType: TableType;
  cellClassName?: DataSheetGridProps['cellClassName'];
  stickyRightColumn?: DataSheetGridProps['stickyRightColumn'];
  headerRowHeight?: number;
  onChange?: (
    rows: T[],
    previousRows: T[],
    op: Operation,
    setRows: React.Dispatch<React.SetStateAction<T[]>>
  ) => void;
};

const TimesStops = <T extends TimeStopsRow>({
  allWaypoints,
  tableType,
  cellClassName,
  stickyRightColumn,
  headerRowHeight,
  onChange,
}: TimesStopsProps<T>) => {
  const { t } = useTranslation('timesStops');

  const [rows, setRows] = useState<T[]>([]);

  useEffect(() => {
    if (allWaypoints) {
      setRows(allWaypoints);
    }
  }, [allWaypoints]);

  const columns = useTimeStopsColumns(tableType, allWaypoints);

  if (!allWaypoints) {
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
          onChange(newRows, rows, op, setRows);
        }
      }}
      stickyRightColumn={stickyRightColumn}
      lockRows
      height={600}
      headerRowHeight={headerRowHeight}
      rowClassName={({ rowData, rowIndex }) =>
        cx({
          activeRow: rowIndex === 0 || rowIndex === allWaypoints.length - 1 || rowData.isVia,
        })
      }
      cellClassName={cellClassName}
    />
  );
};

export default TimesStops;
