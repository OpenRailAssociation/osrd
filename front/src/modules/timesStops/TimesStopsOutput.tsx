import cx from 'classnames';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  PathfindingResultSuccess,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import type { SimulationSummary } from 'modules/timetableItem/components/Timetable/types';
import type { Train } from 'reducers/osrdconf/types';
import { NO_BREAK_SPACE } from 'utils/strings';

import useOutputTableData from './hooks/useOutputTableData';
import TimesStops from './TimesStops';
import { TableType, type TimesStopsRow } from './types';

type TimesStopsOutputProps = {
  isValid: boolean;
  selectedTrain?: Train;
  simulatedTrain?: SimulationResponseSuccess['final_output'];
  simulatedPath?: PathfindingResultSuccess;
  simulatedPathItemTimes?: Extract<SimulationSummary, { isValid: true }>['pathItemTimes'];
  simulatedOperationalPoints?: PathPropertiesFormatted['operationalPoints'];
};

const TimesStopsOutput = ({
  isValid,
  selectedTrain,
  simulatedTrain,
  simulatedPath,
  simulatedPathItemTimes,
  simulatedOperationalPoints,
}: TimesStopsOutputProps) => {
  const rows = useOutputTableData(
    isValid,
    selectedTrain,
    simulatedTrain,
    simulatedPath,
    simulatedPathItemTimes,
    simulatedOperationalPoints
  );
  return (
    <TimesStops
      rows={rows}
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
      dataIsLoading={!simulatedPathItemTimes || !simulatedOperationalPoints || !selectedTrain}
    />
  );
};

export default TimesStopsOutput;
