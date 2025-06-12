import cx from 'classnames';

import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { PathfindingResultSuccess } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';
import type { Train } from 'reducers/osrdconf/types';
import { NO_BREAK_SPACE } from 'utils/strings';

import useOutputTableData from './hooks/useOutputTableData';
import TimesStops from './TimesStops';
import { TableType, type TimesStopsRow } from './types';

type TimesStopsOutputProps = {
  simulatedTimetableItem?: SimulationResponseSuccess;
  timetableItemWithDetails?: TimetableItemWithDetails;
  operationalPoints?: PathPropertiesFormatted['operationalPoints'];
  selectedTrain?: Train;
  path?: PathfindingResultSuccess;
};

const TimesStopsOutput = ({
  simulatedTimetableItem,
  timetableItemWithDetails,
  operationalPoints,
  selectedTrain,
  path,
}: TimesStopsOutputProps) => {
  const enrichedOperationalPoints = useOutputTableData(
    simulatedTimetableItem?.final_output,
    timetableItemWithDetails,
    operationalPoints,
    selectedTrain,
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
      dataIsLoading={!timetableItemWithDetails || !operationalPoints || !selectedTrain}
    />
  );
};

export default TimesStopsOutput;
