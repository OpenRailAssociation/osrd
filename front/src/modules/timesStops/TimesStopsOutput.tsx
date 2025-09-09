import cx from 'classnames';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  PathfindingResultSuccess,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import type { SimulationSummary } from 'modules/timetableItem/types';
import type { Train } from 'reducers/osrdconf/types';
import { formatLocalTime } from 'utils/date';

import useOutputTableData from './hooks/useOutputTableData';
import TimesStops from './TimesStops';
import { TableType, type TimesStopsRow } from './types';

type TimesStopsOutputProps = {
  infraId: number;
  isValid: boolean;
  selectedTrain?: Train;
  simulatedTrain?: SimulationResponseSuccess['final_output'];
  simulatedPath?: PathfindingResultSuccess;
  simulatedPathItemTimes?: Extract<SimulationSummary, { isValid: true }>['pathItemTimes'];
  operationalPointsOnPath?: PathPropertiesFormatted['operationalPoints'];
};

const TimesStopsOutput = ({
  infraId,
  isValid,
  selectedTrain,
  simulatedTrain,
  simulatedPathItemTimes,
  operationalPointsOnPath,
}: TimesStopsOutputProps) => {
  const rows = useOutputTableData(
    infraId,
    isValid,
    selectedTrain,
    simulatedTrain,
    simulatedPathItemTimes,
    operationalPointsOnPath
  );
  return (
    <TimesStops
      rows={rows}
      tableType={TableType.Output}
      cellClassName={({ rowData: rowData_, columnId }) => {
        const rowData = rowData_ as TimesStopsRow;
        // TODO: compare Date objects rather than strings
        const arrivalScheduleNotRespected =
          rowData.arrival?.time && rowData.calculatedArrival
            ? formatLocalTime(rowData.calculatedArrival) !== rowData.arrival.time
            : false;
        const negativeDiffMargins = rowData.diffMargins && parseInt(rowData.diffMargins) < 0;
        return cx({
          'warning-schedule': arrivalScheduleNotRespected,
          'warning-margin': negativeDiffMargins,
          'secondary-code-column': columnId === 'ch',
        });
      }}
      headerRowHeight={40}
      dataIsLoading={!selectedTrain}
    />
  );
};

export default TimesStopsOutput;
