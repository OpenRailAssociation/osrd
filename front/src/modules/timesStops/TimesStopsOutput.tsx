import React from 'react';

import cx from 'classnames';

import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders/Loader';
import type { OperationalPointWithTimeAndSpeed } from 'modules/trainschedule/components/DriverTrainScheduleV2/types';
import { NO_BREAK_SPACE } from 'utils/strings';

import useOutputTableData from './hooks/useOutputTableData';
import TimesStops, { type TimeStopsRow } from './TimesStops';
import { TableType } from './types';

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
      tableType={TableType.Output}
      cellClassName={({ rowData }) => {
        const row = rowData as TimeStopsRow;
        const arrivalScheduleNotRespected = row.arrival
          ? row.calculatedArrival !== row.arrival
          : false;
        const negativeDiffMargins = Number(row.diffMargins?.split(NO_BREAK_SPACE)[0]) < 0;
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
