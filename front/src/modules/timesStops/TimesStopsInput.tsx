/* eslint-disable react/jsx-no-useless-fragment */
import React from 'react';

import { useOsrdConfActions } from 'common/osrdContext';
import { isVia } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { removeElementAtIndex } from 'utils/array';

import TimesStops, { WITH_KP } from './TimesStops';
import { TableType, type PathWaypointRow } from './types';

type DeleteButtonProps = {
  removeVia: () => void;
  rowIndex: number;
  rowData: PathWaypointRow;
  allWaypoints?: SuggestedOP[];
  pathSteps: PathStep[];
};

const createDeleteViaButton = ({
  removeVia,
  rowIndex,
  rowData,
  allWaypoints,
  pathSteps,
}: DeleteButtonProps) => {
  const isRowVia =
    allWaypoints &&
    rowIndex !== 0 &&
    rowIndex !== allWaypoints.length - 1 &&
    isVia(pathSteps, rowData, WITH_KP);
  if (isRowVia) {
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

  const removeVia = (rowData: PathWaypointRow) => {
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

  return (
    <TimesStops
      allWaypoints={allWaypoints}
      pathSteps={pathSteps}
      startTime={startTime}
      tableType={TableType.Input}
      stickyRightColumn={{
        component: ({ rowData, rowIndex }) =>
          createDeleteViaButton({
            removeVia: () => removeVia(rowData),
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
