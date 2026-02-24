import { useEffect, useMemo, useRef, useState } from 'react';

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
  isSimulationDataLoading?: boolean;
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
  isSimulationDataLoading = false,
}: TimesStopsOutputProps) => {
  const useNewTimesStopsTable = useSelector(getUseNewTimesStopsTable);

  // Refs used to track simulation refresh after a user edit (see isAwaitingSimulation):
  //   - preEditPathItemTimesRef: batch summary (simulatedPathItemTimes reference)
  //   - isTrainSimulationPendingRef: all simulation queries (isSimulationDataLoading)
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

  const { rows: newRows, stableIsValid } = useTimesStopsTableData(
    infraId,
    isValid,
    isSimulationDataLoading,
    selectedTrain,
    useNewTimesStopsTable ? simulatedTrain : undefined,
    useNewTimesStopsTable ? simulatedPathItemTimes : undefined,
    useNewTimesStopsTable ? simulatedPathItemRespect : undefined,
    useNewTimesStopsTable ? operationalPointsOnPath : undefined
  );

  // Keeps the last edit visible until selectedTrain.schedule gets a new reference.
  // Bridges the gap between the save request completing and the Redux update propagating through the tree.
  // Note: useOptimistic was considered but doesn't work here. It reverts to the source state as soon
  // as the async action resolves, but at that point selectedTrain.schedule hasn't been updated yet by
  // Redux — causing the same flash. pinnedState stays active until the data itself changes.
  const [pinnedState, setPinnedState] = useState<{
    edit: PendingEdit;
    forSchedule: Train['schedule'];
  } | null>(null);

  const optimisticEdit =
    pinnedState !== null && pinnedState.forSchedule === selectedTrain.schedule
      ? pinnedState.edit
      : null;

  const optimisticRows = useMemo(
    () =>
      optimisticEdit
        ? newRows.map((row) =>
            row.id === optimisticEdit.rowId
              ? { ...row, ...computeOptimisticSchedule(row, optimisticEdit) }
              : row
          )
        : newRows,
    [newRows, optimisticEdit]
  );

  const startTime = useMemo(() => new Date(selectedTrain.start_time), [selectedTrain.start_time]);

  const { updateArrival, updateStopDuration, updateDeparture } = useUpdateTimesStopsTable(
    selectedTrain,
    newRows,
    timetableItemsWithDetails,
    upsertTimetableItems
  );

  // True if we are still waiting for fresh simulation data after a user edit.
  // Both conditions must be false before we clear the loading state:
  //   - Condition 1 (batch summary): simulatedPathItemTimes must get a new reference.
  //   - Condition 2 (all simulation queries): isSimulationDataLoading must be false.
  const isAwaitingSimulation =
    (preEditPathItemTimesRef.current !== undefined &&
      simulatedPathItemTimes === preEditPathItemTimesRef.current) ||
    (isTrainSimulationPendingRef.current && isSimulationDataLoading);

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

  const commitEdit = (edit: PendingEdit, updateFn: () => Promise<void>) => {
    if (isAwaitingSimulation) return;
    setPinnedState({ edit, forSchedule: selectedTrain.schedule });
    preEditPathItemTimesRef.current = simulatedPathItemTimes;
    isTrainSimulationPendingRef.current = true;
    updateFn().catch(() => {
      setPinnedState(null);
      preEditPathItemTimesRef.current = undefined;
      isTrainSimulationPendingRef.current = false;
    });
  };

  const handleArrivalChange = (row: TimesStopsRowNew, arrival: Date | null) =>
    commitEdit({ rowId: row.id, field: 'requestedArrival', value: arrival }, () =>
      updateArrival(row, arrival)
    );

  const handleDepartureChange = (row: TimesStopsRowNew, departure: Date | null) =>
    commitEdit({ rowId: row.id, field: 'requestedDeparture', value: departure }, () =>
      updateDeparture(row, departure)
    );

  const handleStopDurationChange = (row: TimesStopsRowNew, durationSeconds: number | null) =>
    commitEdit(
      {
        rowId: row.id,
        field: 'stopDuration',
        value: durationSeconds !== null ? new Duration({ seconds: durationSeconds }) : null,
      },
      () => updateStopDuration(row, durationSeconds)
    );

  if (useNewTimesStopsTable) {
    return (
      <TimesStopsTable
        rows={optimisticRows}
        startTime={startTime}
        isValid={stableIsValid}
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
