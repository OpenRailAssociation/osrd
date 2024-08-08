/* eslint-disable react/jsx-no-useless-fragment */
import React, { useMemo } from 'react';

import { useOsrdConfActions } from 'common/osrdContext';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { removeElementAtIndex } from 'utils/array';

import TimesStops, { type TimeStopsRow } from './TimesStops';
import { TableType } from './types';
import type { Operation } from 'react-datasheet-grid/dist/types';
import { time2sec } from 'utils/timeManipulation';
import { marginRegExValidation } from './consts';
import { formatSuggestedViasToRowVias } from './helpers/utils';
import { useTranslation } from 'react-i18next';

type DeleteButtonProps = {
  removeVia: () => void;
  row: TimeStopsRow;
};

const createDeleteViaButton = ({ removeVia, row }: DeleteButtonProps) => (
  <>
    {row.isVia && (
      <button type="button" onClick={removeVia}>
        ❌
      </button>
    )}
  </>
);

type TimesStopsInputRow = SuggestedOP & TimeStopsRow;

type TimesStopsInputProps = {
  allWaypoints?: SuggestedOP[];
  startTime: string;
  pathSteps: PathStep[];
};

const TimesStopsInput = ({ allWaypoints, startTime, pathSteps }: TimesStopsInputProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('timesStops');
  const { updatePathSteps, upsertViaFromSuggestedOP } = useOsrdConfActions();

  const removeVia = (rowData: SuggestedOP) => {
    const index = pathSteps.findIndex((step) => {
      if ('uic' in step) {
        return step.uic === rowData.uic && step.ch === rowData.ch && step.name === rowData.name;
      }
      if ('track' in step) {
        return step.track === rowData.track;
      }
      return false;
    });
    const updatedPathSteps = removeElementAtIndex(pathSteps, index);

    dispatch(updatePathSteps({ pathSteps: updatedPathSteps }));
  };

  const onChange = (
    rows: TimesStopsInputRow[],
    previousRows: TimesStopsInputRow[],
    op: Operation,
    setRows: React.Dispatch<React.SetStateAction<TimesStopsInputRow[]>>
  ) => {
    const row = { ...rows[op.fromRowIndex] };
    const previousRow = { ...previousRows[op.fromRowIndex] };
    if (
      row.departure &&
      row.arrival &&
      (row.arrival !== previousRow.arrival || row.departure !== previousRow.departure)
    ) {
      row.stopFor = String(time2sec(row.departure) - time2sec(row.arrival));
    }
    if (!row.stopFor && op.fromRowIndex !== rows.length - 1) {
      row.onStopSignal = false;
    }

    if (row.theoreticalMargin && !marginRegExValidation.test(row.theoreticalMargin!)) {
      row.isMarginValid = false;
      setRows(rows);
    } else {
      row.isMarginValid = true;
      if (op.fromRowIndex === 0) {
        row.arrival = null;
        // As we put 0% by default for origin's margin, if the user removes a margin without
        // replacing it to 0% (undefined), we change it to 0%
        if (!row.theoreticalMargin) row.theoreticalMargin = '0%';
      }
      dispatch(upsertViaFromSuggestedOP(row as SuggestedOP));
    }
  };

  const data: TimesStopsInputRow[] = useMemo(() => {
    if (allWaypoints) {
      const suggestedOPs = formatSuggestedViasToRowVias(
        allWaypoints,
        pathSteps,
        t,
        startTime,
        TableType.Input
      );
      return suggestedOPs;
    }
    return [];
  }, [allWaypoints, pathSteps, startTime]);

  return (
    <TimesStops
      allWaypoints={data}
      tableType={TableType.Input}
      onChange={onChange}
      stickyRightColumn={{
        component: ({ rowData: row }) =>
          createDeleteViaButton({
            removeVia: () => removeVia(row),
            row,
          }),
      }}
    />
  );
};

export default TimesStopsInput;
