import cx from 'classnames';

import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { PathfindingResultSuccess, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';
import { NO_BREAK_SPACE } from 'utils/strings';

import useOutputTableData from './hooks/useOutputTableData';
import TimesStops from './TimesStops';
import { TableType, type TimesStopsRow } from './types';

type TimesStopsOutputProps = {
  simulatedTrain?: SimulationResponseSuccess;
  trainSummary?: TimetableItemWithDetails;
  operationalPoints?: PathPropertiesFormatted['operationalPoints'];
  selectedTrainSchedule?: TrainScheduleResult;
  path?: PathfindingResultSuccess;
  dataIsLoading: boolean;
};

const TimesStopsOutput = ({
  simulatedTrain,
  trainSummary,
  operationalPoints,
  selectedTrainSchedule,
  path,
  dataIsLoading,
}: TimesStopsOutputProps) => {
  const enrichedOperationalPoints = useOutputTableData(
    simulatedTrain?.final_output,
    trainSummary,
    operationalPoints,
    selectedTrainSchedule,
    path
  );
  return (
    <TimesStops
      rows={enrichedOperationalPoints}
      tableType={TableType.Output}
      cellClassName={({ rowData: rowData_, columnId }) => {
        const rowData = rowData_ as TimesStopsRow;
        const arrivalScheduleNotRespected = rowData.arrival?.time
          ? rowData.calculatedArrival !== rowData.arrival.time
          : false;
        const negativeDiffMargins = Number(rowData.diffMargins?.split(NO_BREAK_SPACE)[0]) < 0;
        return cx({
          'warning-schedule': arrivalScheduleNotRespected,
          'warning-margin': negativeDiffMargins,
          'secondary-code-column': columnId === 'ch',
        });
      }}
      headerRowHeight={40}
      dataIsLoading={dataIsLoading || !trainSummary || !operationalPoints || !selectedTrainSchedule}
    />
  );
};

export default TimesStopsOutput;
