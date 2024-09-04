import { useState, useEffect } from 'react';

import cx from 'classnames';
import { isEqual } from 'lodash';
import { DynamicDataSheetGrid, type DataSheetGridProps } from 'react-datasheet-grid';
import { useTranslation } from 'react-i18next';

import { useOsrdConfActions } from 'common/osrdContext';
import type { IsoDateTimeString } from 'common/types';
import { isVia } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import {
  formatSuggestedViasToRowVias,
  updateRowTimesAndMargin,
  updateDaySinceDeparture,
  durationSinceStartTime,
} from './helpers/utils';
import { useTimeStopsColumns } from './hooks/useTimeStopsColumns';
import { TableType } from './types';
import type { PathWaypointRow } from './types';

export const WITH_KP = true;

type TimesStopsProps = {
  allWaypoints?: SuggestedOP[];
  pathSteps?: PathStep[];
  startTime?: IsoDateTimeString;
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
  const { upsertSeveralViasFromSuggestedOP } = useOsrdConfActions();

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
      setRows(updateDaySinceDeparture(suggestedOPs, startTime, true));
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
      onChange={(newRows: PathWaypointRow[], [op]) => {
        if (!isInputTable) {
          return;
        }
        let updatedRows = [...newRows];
        updatedRows[op.fromRowIndex] = updateRowTimesAndMargin(
          newRows[op.fromRowIndex],
          rows[op.fromRowIndex],
          op,
          allWaypoints.length
        );
        updatedRows = updateDaySinceDeparture(updatedRows, startTime);
        if (!updatedRows[op.fromRowIndex].isMarginValid) {
          newRows[op.fromRowIndex].isMarginValid = false;
          setRows(newRows);
        } else if (
          !rows[op.fromRowIndex].isMarginValid &&
          updatedRows[op.fromRowIndex].isMarginValid
        ) {
          newRows[op.fromRowIndex].isMarginValid = true;
          setRows(newRows);
        } else {
          const newVias = updatedRows
            .filter((row, index) => !isEqual(row, rows[index]))
            .map(
              (row) =>
                ({
                  ...row,
                  ...(row.arrival && { arrival: durationSinceStartTime(startTime, row.arrival) }),
                }) as SuggestedOP
            );
          dispatch(upsertSeveralViasFromSuggestedOP(newVias));
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
            isVia(pathSteps || [], rowData, { withKP: true }),
        })
      }
      cellClassName={cellClassName}
    />
  );
};

export default TimesStops;
