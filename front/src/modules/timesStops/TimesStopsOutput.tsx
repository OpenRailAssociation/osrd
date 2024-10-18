import cx from 'classnames';

import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { PathfindingResultSuccess, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders/Loader';
import type { OperationalPointWithTimeAndSpeed } from 'modules/trainschedule/components/DriverTrainSchedule/types';
import { NO_BREAK_SPACE } from 'utils/strings';

import useOutputTableData from './hooks/useOutputTableData';
import TimesStops from './TimesStops';
import { TableType, type TimeStopsRow } from './types';

type TimesStopsOutputProps = {
  simulatedTrain: SimulationResponseSuccess;
  pathProperties: PathPropertiesFormatted;
  operationalPoints: OperationalPointWithTimeAndSpeed[];
  selectedTrainSchedule: TrainScheduleResult;
  path?: PathfindingResultSuccess;
  dataIsLoading: boolean;
};

const TimesStopsOutput = ({
  simulatedTrain,
  pathProperties,
  operationalPoints,
  selectedTrainSchedule,
  path,
  dataIsLoading,
}: TimesStopsOutputProps) => {
  const enrichedOperationalPoints = useOutputTableData(
    simulatedTrain,
    pathProperties,
    operationalPoints,
    selectedTrainSchedule,
    path
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
      rows={enrichedOperationalPoints}
      tableType={TableType.Output}
      cellClassName={({ rowData: rowData_, columnId }) => {
        const rowData = rowData_ as TimeStopsRow;
        const arrivalScheduleNotRespected = rowData.arrival?.time
          ? rowData.calculatedArrival !== rowData.arrival.time
          : false;
        const negativeDiffMargins = Number(rowData.diffMargins?.split(NO_BREAK_SPACE)[0]) < 0;
        return cx({
          'warning-schedule': arrivalScheduleNotRespected,
          'warning-margin': negativeDiffMargins,
          'cell-index': columnId === 'ch',
        });
      }}
      headerRowHeight={65}
    />
  );
};

export default TimesStopsOutput;
