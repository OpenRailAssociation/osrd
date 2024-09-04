import React, { useState, useEffect } from 'react';

import cx from 'classnames';
import { DynamicDataSheetGrid, type DataSheetGridProps } from 'react-datasheet-grid';
import { useTranslation } from 'react-i18next';

import { useOsrdConfActions } from 'common/osrdContext';
import { isVia } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { time2sec } from 'utils/timeManipulation';

import { marginRegExValidation } from './consts';
import { formatSuggestedViasToRowVias } from './helpers/utils';
import { useTimeStopsColumns } from './hooks/useTimeStopsColumns';
import { TableType } from './types';
import type { PathWaypointRow } from './types';

export const WITH_KP = true;

type TimesStopsProps = {
  allWaypoints?: SuggestedOP[];
  pathSteps?: PathStep[];
  startTime?: string;
  tableType: TableType;
  cellClassName?: DataSheetGridProps['cellClassName'];
  stickyRightColumn?: DataSheetGridProps['stickyRightColumn'];
  headerRowHeight?: number;
};

const TimesStops = ({
  allWaypoints,
  pathSteps,
  startTime,
  tableType,
  cellClassName,
  stickyRightColumn,
  headerRowHeight,
}: TimesStopsProps) => {
  const isInputTable = tableType === TableType.Input;
  const { t } = useTranslation('timesStops');

  const dispatch = useAppDispatch();
  const { upsertViaFromSuggestedOP } = useOsrdConfActions();

  const [rows, setRows] = useState<PathWaypointRow[]>([]);

  useEffect(() => {
    if (allWaypoints) {
      const suggestedOPs = formatSuggestedViasToRowVias(
        allWaypoints,
        pathSteps || [],
        t,
        startTime,
        tableType
      );
      setRows(suggestedOPs);
    }
  }, [allWaypoints, pathSteps, startTime]);

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
      onChange={(row: PathWaypointRow[], [op]) => {
        if (!isInputTable) {
          return;
        }
        const rowData = { ...row[op.fromRowIndex] };
        const previousRowData = rows[op.fromRowIndex];
        if (
          rowData.departure &&
          rowData.arrival &&
          (rowData.arrival !== previousRowData.arrival ||
            rowData.departure !== previousRowData.departure)
        ) {
          rowData.stopFor = String(time2sec(rowData.departure) - time2sec(rowData.arrival));
        }
        if (!rowData.stopFor && op.fromRowIndex !== allWaypoints.length - 1) {
          rowData.onStopSignal = false;
        }
        if (rowData.theoreticalMargin && !marginRegExValidation.test(rowData.theoreticalMargin!)) {
          rowData.isMarginValid = false;
          setRows(row);
        } else {
          rowData.isMarginValid = true;
          if (op.fromRowIndex === 0) {
            rowData.arrival = null;
            // As we put 0% by default for origin's margin, if the user removes a margin without
            // replacing it to 0% (undefined), we change it to 0%
            if (!rowData.theoreticalMargin) rowData.theoreticalMargin = '0%';
          }
          dispatch(upsertViaFromSuggestedOP(rowData as SuggestedOP));
        }
      }}
      stickyRightColumn={stickyRightColumn}
      lockRows
      height={600}
      headerRowHeight={headerRowHeight}
      rowClassName={({ rowData, rowIndex }) =>
        cx({
          activeRow:
            rowIndex === 0 ||
            rowIndex === allWaypoints.length - 1 ||
            isVia(pathSteps || [], rowData, WITH_KP),
        })
      }
      cellClassName={cellClassName}
    />
  );
};

export default TimesStops;
