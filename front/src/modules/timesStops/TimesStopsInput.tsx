/* eslint-disable react/jsx-no-useless-fragment */
import React from 'react';

import { useOsrdConfActions } from 'common/osrdContext';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import TimesStops from './TimesStops';
import { TableType, type PathWaypointRow } from './types';

type ClearButtonProps = {
  removeVia: () => void;
  rowIndex: number;
  rowData: PathWaypointRow;
  allWaypoints?: SuggestedOP[];
  pathSteps: PathStep[];
};

const createClearViaButton = ({ removeVia, rowIndex, rowData, allWaypoints }: ClearButtonProps) => {
  const isClearBtnShown =
    allWaypoints &&
    rowIndex > 0 &&
    rowIndex < allWaypoints.length - 1 &&
    (rowData.stopFor !== undefined ||
      rowData.theoreticalMargin !== undefined ||
      rowData.arrival !== undefined ||
      rowData.onStopSignal !== false);
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

const TimesStopsinput = ({ allWaypoints, startTime, pathSteps }: TimesStopsInputProps) => {
  const dispatch = useAppDispatch();
  const { updatePathSteps } = useOsrdConfActions();

  const clearPathStep = (rowData: PathWaypointRow) => {
    const isMatchingUICStep = (step: PathStep) =>
      'uic' in step &&
      step.uic === rowData.uic &&
      step.secondary_code === rowData.ch &&
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
          onStopSignal: undefined,
        };
      }
      return step;
    });
    dispatch(updatePathSteps({ pathSteps: updatedPathSteps }));
  };

  return (
    <TimesStops
      allWaypoints={allWaypoints}
      pathSteps={pathSteps}
      startTime={startTime}
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
    />
  );
};

export default TimesStopsinput;
