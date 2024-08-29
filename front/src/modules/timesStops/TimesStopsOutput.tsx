import React from 'react';

import cx from 'classnames';

import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders/Loader';
import type { OperationalPointWithTimeAndSpeed } from 'modules/trainschedule/components/DriverTrainScheduleV2/types';
import { convertIsoUtcToLocalTime } from 'utils/date';
import { NO_BREAK_SPACE } from 'utils/strings';

import useOutputTableData from './hooks/useOutputTableData';
import TimesStops from './TimesStops';
import { TableType, type PathWaypointRow } from './types';

type TimesStopsOutputProps = {
  simulatedTrain: SimulationResponseSuccess;
  pathProperties: PathPropertiesFormatted;
  operationalPoints: OperationalPointWithTimeAndSpeed[];
  selectedTrainSchedule: TrainScheduleResult;
  pathLength?: number;
  dataIsLoading: boolean;
};

const TimesStopsOutput = ({
  simulatedTrain,
  pathProperties,
  operationalPoints,
  selectedTrainSchedule,
  pathLength,
  dataIsLoading,
}: TimesStopsOutputProps) => {
  const startTime = convertIsoUtcToLocalTime(selectedTrainSchedule.start_time);
  const enrichedOperationalPoints = useOutputTableData(
    simulatedTrain,
    pathProperties,
    operationalPoints,
    selectedTrainSchedule,
    pathLength
  );
  if (dataIsLoading) {
    return (
      <div style={{ height: '600px' }}>
        <Loader />
      </div>
    );
  }
  return (
    <TimesStops
      allWaypoints={enrichedOperationalPoints}
      startTime={startTime}
      tableType={TableType.Output}
      cellClassName={({ rowData: rowData_ }) => {
        const rowData = rowData_ as PathWaypointRow;
        const arrivalScheduleNotRespected = rowData.arrival
          ? rowData.calculatedArrival !== rowData.arrival
          : false;
        const negativeDiffMargins = Number(rowData.diffMargins?.split(NO_BREAK_SPACE)[0]) < 0;
        return cx({
          'warning-schedule': arrivalScheduleNotRespected,
          'warning-margin': negativeDiffMargins,
        });
      }}
      headerRowHeight={65}
    />
  );
};

export default TimesStopsOutput;
