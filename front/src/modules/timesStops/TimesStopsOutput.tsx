import { useEffect, useMemo, useOptimistic, useRef, startTransition } from 'react';

import cx from 'classnames';
import { useSelector } from 'react-redux';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  CorePathfindingResultSuccess,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import type { SimulationSummary, TimetableItemWithDetails } from 'modules/timetableItem/types';
import type { TimetableItem, Train } from 'reducers/osrdconf/types';
import { getUseNewTimesStopsTable } from 'reducers/user/userSelectors';
import { formatLocalTime } from 'utils/date';
import { Duration } from 'utils/duration';

import { computeOptimisticSchedule } from './helpers/cellUpdate';
import useOutputTableData from './hooks/useOutputTableData';
import useTimesStopsTableData from './hooks/useTimesStopsTableData';
import useUpdateTimesStopsTable from './hooks/useUpdateTimesStopsTable';
import TimesStops from './TimesStops';
import TimesStopsTable from './TimesStopsTable';
import { TableType, type PendingEdit, type TimesStopsRow, type TimesStopsRowNew } from './types';

type TimesStopsOutputProps = {
  infraId: number;
  isValid?: boolean;
  selectedTrain: Train;
  timetableItemsWithDetails: TimetableItemWithDetails[];
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  simulatedTrain?: SimulationResponseSuccess['final_output'];
  simulatedPath?: CorePathfindingResultSuccess;
  simulatedPathItemTimes?: Extract<SimulationSummary, { isValid: true }>['pathItemTimes'];
  simulatedPathItemRespect?: Extract<SimulationSummary, { isValid: true }>['pathItemRespect'];
  operationalPointsOnPath?: PathPropertiesFormatted['operationalPoints'];
  isSimulationFetching?: boolean;
};

const TimesStopsOutput = ({
  infraId,
  isValid = false,
  selectedTrain,
  timetableItemsWithDetails,
  upsertTimetableItems,
  simulatedTrain,
  simulatedPathItemTimes,
  simulatedPathItemRespect,
  operationalPointsOnPath,
  isSimulationFetching = false,
}: TimesStopsOutputProps) => {
  const useNewTimesStopsTable = useSelector(getUseNewTimesStopsTable);

  // Refs used to track simulation refresh after a user edit (see isAwaitingSimulation):
  //   - preEditPathItemTimesRef: batch summary (simulatedPathItemTimes reference)
  //   - isTrainSimulationPendingRef: per-train simulation (getTrainSimulation isFetching)
  const preEditPathItemTimesRef = useRef<typeof simulatedPathItemTimes>(undefined);
  const isTrainSimulationPendingRef = useRef(false);

  // Only call the hook that corresponds to the active table to avoid unnecessary computation
  const legacyRows = useOutputTableData(
    infraId,
    isValid,
    useNewTimesStopsTable ? undefined : selectedTrain,
    useNewTimesStopsTable ? undefined : simulatedTrain,
    useNewTimesStopsTable ? undefined : simulatedPathItemTimes,
    useNewTimesStopsTable ? undefined : operationalPointsOnPath
  );

  const newRows = useTimesStopsTableData(
    infraId,
    isValid,
    selectedTrain,
    useNewTimesStopsTable ? simulatedTrain : undefined,
    useNewTimesStopsTable ? simulatedPathItemTimes : undefined,
    useNewTimesStopsTable ? simulatedPathItemRespect : undefined,
    useNewTimesStopsTable ? operationalPointsOnPath : undefined
  );

  // Optimistic update: immediately show consistent derived schedule fields.
  // Computed simulation fields show loading placeholders via isComputedDataPending.
  // useOptimistic reverts to real newRows once the transition (API call) completes.
  const [optimisticRows, addOptimisticEdit] = useOptimistic(newRows, (rows, edit: PendingEdit) =>
    rows.map((row) =>
      row.id === edit.rowId ? { ...row, ...computeOptimisticSchedule(row, edit) } : row
    )
  );

  const startTime = useMemo(() => new Date(selectedTrain.start_time), [selectedTrain.start_time]);

  const { updateArrival, updateStopDuration, updateDeparture } = useUpdateTimesStopsTable(
    selectedTrain,
    newRows,
    timetableItemsWithDetails,
    upsertTimetableItems
  );

  // True if we are still waiting for fresh simulation data after a user edit.
  // Both pipelines must finish before we clear the loading state:
  //   - Condition 1 (batch summary): wait until simulatedPathItemTimes gets a new reference.
  //   - Condition 2 (train simulation): wait until getTrainSimulation stops fetching.
  const isAwaitingSimulation =
    (preEditPathItemTimesRef.current !== undefined &&
      simulatedPathItemTimes === preEditPathItemTimesRef.current) ||
    (isTrainSimulationPendingRef.current && isSimulationFetching);

  // Reset refs once both simulation pipelines are done
  useEffect(() => {
    if (
      !isAwaitingSimulation &&
      (preEditPathItemTimesRef.current !== undefined || isTrainSimulationPendingRef.current)
    ) {
      preEditPathItemTimesRef.current = undefined;
      isTrainSimulationPendingRef.current = false;
    }
  }, [isAwaitingSimulation]);

  // Call this before any edit to start tracking simulation refresh.
  const startSimulationTracking = () => {
    preEditPathItemTimesRef.current = simulatedPathItemTimes;
    isTrainSimulationPendingRef.current = true;
  };

  // Call this on error to cancel the tracking started by startSimulationTracking.
  const cancelSimulationTracking = () => {
    preEditPathItemTimesRef.current = undefined;
    isTrainSimulationPendingRef.current = false;
  };

  const handleArrivalChange = (row: TimesStopsRowNew, arrival: Date | null) => {
    if (isAwaitingSimulation) return;
    startSimulationTracking();
    startTransition(async () => {
      addOptimisticEdit({ rowId: row.id, field: 'requestedArrival', value: arrival });
      try {
        await updateArrival(row, arrival);
      } catch {
        cancelSimulationTracking();
      }
    });
  };

  const handleDepartureChange = (row: TimesStopsRowNew, departure: Date | null) => {
    if (isAwaitingSimulation) return;
    startSimulationTracking();
    startTransition(async () => {
      addOptimisticEdit({ rowId: row.id, field: 'requestedDeparture', value: departure });
      try {
        await updateDeparture(row, departure);
      } catch {
        cancelSimulationTracking();
      }
    });
  };

  const handleStopDurationChange = (row: TimesStopsRowNew, durationSeconds: number | null) => {
    if (isAwaitingSimulation) return;
    startSimulationTracking();
    startTransition(async () => {
      addOptimisticEdit({
        rowId: row.id,
        field: 'stopDuration',
        value: durationSeconds !== null ? new Duration({ seconds: durationSeconds }) : null,
      });
      try {
        await updateStopDuration(row, durationSeconds);
      } catch {
        cancelSimulationTracking();
      }
    });
  };

  if (useNewTimesStopsTable) {
    return (
      <TimesStopsTable
        rows={optimisticRows}
        startTime={startTime}
        isValid={isValid}
        isComputedDataPending={isAwaitingSimulation}
        onArrivalChange={handleArrivalChange}
        onStopDurationChange={handleStopDurationChange}
        onDepartureChange={handleDepartureChange}
      />
    );
  }

  return (
    <TimesStops
      rows={legacyRows}
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
      dataIsLoading={newRows.length === 0}
    />
  );
};

export default TimesStopsOutput;
