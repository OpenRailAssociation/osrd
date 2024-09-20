import cx from 'classnames';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type { PathfindingResultSuccess, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders/Loader';
import { NO_BREAK_SPACE } from 'utils/strings';

import useOutputTableData from './hooks/useOutputTableData';
import TimesStops from './TimesStops';
import { TableType, type TimeStopsRow } from './types';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/Timetable/types';

type TimesStopsOutputProps = {
  trainSummary: TrainScheduleWithDetails;
  pathProperties: PathPropertiesFormatted;
  selectedTrainSchedule: TrainScheduleResult;
  path?: PathfindingResultSuccess;
  dataIsLoading: boolean;
};

const TimesStopsOutput = ({
  trainSummary,
  pathProperties,
  selectedTrainSchedule,
  path,
  dataIsLoading,
}: TimesStopsOutputProps) => {
  const enrichedOperationalPoints = useOutputTableData(
    trainSummary,
    pathProperties,
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
      cellClassName={({ rowData: rowData_ }) => {
        const rowData = rowData_ as TimeStopsRow;
        const arrivalScheduleNotRespected = rowData.arrival?.time
          ? rowData.calculatedArrival !== rowData.arrival.time
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
