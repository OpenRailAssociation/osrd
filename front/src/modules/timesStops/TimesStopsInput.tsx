/* eslint-disable react/jsx-no-useless-fragment */
import { useCallback, useEffect, useState } from 'react';

import { isEqual, isNil } from 'lodash';
import type { Operation } from 'react-datasheet-grid/dist/types';
import { useTranslation } from 'react-i18next';

import { useOsrdConfActions } from 'common/osrdContext';
import { isVia } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import {
  durationSinceStartTime,
  formatSuggestedViasToRowVias,
  onStopSignalToReceptionSignal,
  updateDaySinceDeparture,
  updateRowTimesAndMargin,
} from './helpers/utils';
import TimesStops from './TimesStops';
import { TableType, type TimesStopsInputRow } from './types';

type ClearButtonProps = {
  removeVia: () => void;
  rowIndex: number;
  rowData: TimesStopsInputRow;
  allWaypoints?: SuggestedOP[];
  pathSteps: PathStep[];
};

const createClearViaButton = ({
  removeVia,
  rowIndex,
  rowData,
  allWaypoints,
  pathSteps,
}: ClearButtonProps) => {
  const isClearBtnShown =
    allWaypoints &&
    rowIndex > 0 &&
    rowIndex < allWaypoints.length - 1 &&
    isVia(pathSteps || [], rowData, { withKP: true }) &&
    (!isNil(rowData.stopFor) ||
      rowData.theoreticalMargin !== undefined ||
      rowData.arrival !== undefined ||
      rowData.onStopSignal === true);
  if (isClearBtnShown) {
    return (
      <button type="button" onClick={removeVia}>
        ❌
      </button>
    );
  }
  return <></>;
};

type TimesStopsInputProps = {
  allWaypoints?: SuggestedOP[];
  startTime: string;
  pathSteps: PathStep[];
};

const TimesStopsInput = ({ allWaypoints, startTime, pathSteps }: TimesStopsInputProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('timesStops');
  const { updatePathSteps, upsertSeveralViasFromSuggestedOP } = useOsrdConfActions();

  const [rows, setRows] = useState<TimesStopsInputRow[]>([]);

  const clearPathStep = (rowData: TimesStopsInputRow) => {
    const isMatchingUICStep = (step: PathStep) =>
      'uic' in step &&
      step.uic === rowData.uic &&
      step.ch === rowData.ch &&
      step.name === rowData.name;

    const isMatchingTrackStep = (step: PathStep) =>
      'track' in step &&
      step.track === rowData.track &&
      step.positionOnPath === rowData.positionOnPath &&
      step.offset === rowData.offsetOnTrack &&
      step.id === rowData.opId;

    const index = pathSteps.findIndex(
      (step) => isMatchingUICStep(step) || isMatchingTrackStep(step)
    );

    if (index === -1) return;

    const updatedPathSteps = pathSteps.map((step, i) => {
      if (i === index) {
        return {
          ...step,
          stopFor: undefined,
          theoreticalMargin: undefined,
          arrival: undefined,
          receptionSignal: undefined,
        };
      }
      return step;
    });
    dispatch(updatePathSteps({ pathSteps: updatedPathSteps }));
  };

  const onChange = useCallback(
    (newRows: TimesStopsInputRow[], operation: Operation) => {
      let updatedRows = [...newRows];
      updatedRows[operation.fromRowIndex] = updateRowTimesAndMargin(
        newRows[operation.fromRowIndex],
        rows[operation.fromRowIndex],
        operation,
        rows.length
      );
      updatedRows = updateDaySinceDeparture(updatedRows, startTime);

      if (!updatedRows[operation.fromRowIndex].isMarginValid) {
        newRows[operation.fromRowIndex].isMarginValid = false;
        setRows(newRows);
      } else if (
        !rows[operation.fromRowIndex].isMarginValid &&
        updatedRows[operation.fromRowIndex].isMarginValid
      ) {
        newRows[operation.fromRowIndex].isMarginValid = true;
        setRows(newRows);
      } else {
        const newVias = updatedRows
          .filter((row, index) => !isEqual(row, rows[index]))
          .map(({ onStopSignal, arrival, departure, ...row }) => ({
            ...row,
            arrival: durationSinceStartTime(startTime, arrival),
            departure: durationSinceStartTime(startTime, departure),
            receptionSignal: onStopSignalToReceptionSignal(onStopSignal),
          }));
        dispatch(upsertSeveralViasFromSuggestedOP(newVias));
      }
    },
    [rows, startTime]
  );

  useEffect(() => {
    if (allWaypoints) {
      const suggestedOPs = formatSuggestedViasToRowVias(
        allWaypoints,
        pathSteps || [],
        t,
        startTime,
        TableType.Input
      );
      setRows(updateDaySinceDeparture(suggestedOPs, startTime, { keepFirstIndexArrival: true }));
    }
  }, [allWaypoints, pathSteps, startTime]);

  return (
    <TimesStops
      rows={rows}
      tableType={TableType.Input}
      stickyRightColumn={{
        component: ({ rowData, rowIndex }) =>
          createClearViaButton({
            removeVia: () => clearPathStep(rowData),
            rowIndex,
            rowData,
            allWaypoints,
            pathSteps,
          }),
      }}
      onChange={onChange}
    />
  );
};

export default TimesStopsInput;
