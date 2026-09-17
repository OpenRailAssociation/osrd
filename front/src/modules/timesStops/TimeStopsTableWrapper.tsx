import { useEffect, useMemo, useRef, useState } from 'react';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  CorePathfindingResultSuccess,
  ReceptionSignal,
  RollingStock,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import type { SimulationSummary, TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { Train } from 'reducers/osrdconf/types';
import { Duration, type StartTime } from 'utils/duration';

import { computeOptimisticRow, propagationToEdits } from './helpers/cellUpdate';
import { getRowsToUpdateFromSimulation } from './helpers/fillTimesFromSimulation';
import { computePowerRestrictionWarnings } from './helpers/powerRestrictionIncompatibility';
import { propagateStopDuration } from './helpers/stopDurationPropagation';
import { propagateTime } from './helpers/timePropagation';
import { getTruncatedToSecondStartTime } from './helpers/utils';
import useTimesStopsTableData from './hooks/useTimesStopsTableData';
import useUpdateTimesStopsTable from './hooks/useUpdateTimesStopsTable';
import TimesStopsTable from './TimesStopsTable';
import {
  type ArrivalUpdate,
  type DepartureUpdate,
  type PendingEdit,
  type PropagationMode,
  type StopDurationUpdate,
  type StopPropagationMode,
  type MarginValue,
  type TimesStopsRow,
  type UpdateCellStatus,
  type TimeFillMode,
  type RequestedTimeField,
} from './types';

type TimeStopsTableWrapperProps = {
  infraId: number;
  isValid?: boolean;
  selectedTrain: Train;
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  simulatedTrain?: SimulationResponseSuccess['final_output'];
  simulatedPath?: CorePathfindingResultSuccess;
  simulatedPathItemTimes?: Extract<SimulationSummary, { isValid: true }>['pathItemTimes'];
  simulatedPathItemRespect?: Extract<SimulationSummary, { isValid: true }>['pathItemRespect'];
  operationalPointsOnPath?: PathPropertiesFormatted['operationalPoints'];
  voltages?: PathPropertiesFormatted['voltages'];
  isSimulationDataLoading?: boolean;
  rollingStock?: RollingStock;
};

const TimeStopsTableWrapper = ({
  infraId,
  isValid = false,
  selectedTrain,
  trainSchedulesWithDetails,
  simulatedTrain,
  simulatedPathItemTimes,
  simulatedPathItemRespect,
  operationalPointsOnPath,
  voltages,
  isSimulationDataLoading = false,
  rollingStock,
}: TimeStopsTableWrapperProps) => {
  const { scenario } = useScenarioContext();

  // Refs used to track simulation refresh after a user edit (see isAwaitingSimulation):
  //   - preEditPathItemTimesRef: batch summary (simulatedPathItemTimes reference)
  //   - isTrainSimulationPendingRef: all simulation queries (isSimulationDataLoading)
  const preEditPathItemTimesRef = useRef<typeof simulatedPathItemTimes>(undefined);
  const isTrainSimulationPendingRef = useRef(false);

  const { rows, stableIsValid, allRows } = useTimesStopsTableData(
    infraId,
    isValid,
    isSimulationDataLoading,
    selectedTrain,
    simulatedTrain,
    simulatedPathItemTimes,
    simulatedPathItemRespect,
    operationalPointsOnPath
  );

  // Keeps the last edit visible until selectedTrain.schedule gets a new reference.
  // Bridges the gap between the save request completing and the Redux update propagating through the tree.
  // Note: useOptimistic was considered but doesn't work here. It reverts to the source state as soon
  // as the async action resolves, but at that point selectedTrain.schedule hasn't been updated yet by
  // Redux — causing the same flash. pinnedState stays active until the data itself changes.
  const [pinnedState, setPinnedState] = useState<{
    edits: PendingEdit[];
    forSchedule: Train['schedule'];
    forTrainId: Train['id'];
    forStartTime: Train['start_time'];
  } | null>(null);

  const optimisticEdits =
    pinnedState !== null &&
    pinnedState.forSchedule === selectedTrain.schedule &&
    pinnedState.forStartTime === selectedTrain.start_time &&
    pinnedState.forTrainId === selectedTrain.id
      ? pinnedState.edits
      : null;

  // Clear the pinnedState as soon as real data takes over (optimisticEdits null). Otherwise it stays
  // dormant, and resetting an exception restores the original schedule reference, reactivating the
  // pinnedState and re-showing the stale edit.
  // For more info, see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (pinnedState !== null && optimisticEdits === null) {
    setPinnedState(null);
  }

  const optimisticRows = useMemo(() => {
    if (!optimisticEdits) return rows;

    const editMap = new Map(optimisticEdits.map((e): [string, PendingEdit] => [e.rowId, e]));
    return rows.map((row) => {
      const edit = editMap.get(row.id);
      return edit ? { ...row, ...computeOptimisticRow(row, edit) } : row;
    });
  }, [rows, optimisticEdits]);

  const startTime = useMemo(
    () => getTruncatedToSecondStartTime(selectedTrain, scenario.timetable_type),
    [selectedTrain.start_time, scenario.timetable_type]
  );

  const availablePowerRestrictions = useMemo(
    () => Object.keys(rollingStock?.power_restrictions ?? {}),
    [rollingStock]
  );

  const { blocks: powerRestrictionBlocks, warningCount: powerRestrictionWarningCount } = useMemo(
    () =>
      computePowerRestrictionWarnings({
        rows: allRows,
        path: selectedTrain.path,
        operationalPointsOnPath,
        voltages,
        rollingStock,
      }),
    [allRows, voltages, selectedTrain.path, operationalPointsOnPath, rollingStock]
  );

  const {
    updateArrival,
    updateStopDuration,
    updateDeparture,
    updateReceptionSignal,
    updateRequestedMargin,
    updatePowerRestrictions,
    updateMultipleTimes,
  } = useUpdateTimesStopsTable(selectedTrain, rows, trainSchedulesWithDetails);

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

  const resetPendingState = () => {
    setPinnedState(null);
    preEditPathItemTimesRef.current = undefined;
    isTrainSimulationPendingRef.current = false;
  };

  const commitEdit = (edits: PendingEdit[], updateFn: () => Promise<UpdateCellStatus>) => {
    if (isAwaitingSimulation) return;
    setPinnedState({
      edits,
      forSchedule: selectedTrain.schedule,
      forTrainId: selectedTrain.id,
      forStartTime: selectedTrain.start_time,
    });
    preEditPathItemTimesRef.current = simulatedPathItemTimes;
    isTrainSimulationPendingRef.current = true;
    updateFn()
      .then((status) => {
        if (status === 'skipped') resetPendingState();
      })
      .catch(() => {
        resetPendingState();
      });
  };

  const buildEditsForRequestedTimesUpdate = (
    update: ArrivalUpdate | DepartureUpdate
  ): PendingEdit[] => {
    const propagationResult = propagateTime(update, selectedTrain, scenario.timetable_type);
    // If there is nothing to propagate, the typed value is the only edit
    return propagationResult
      ? propagationToEdits(propagationResult, rows)
      : [{ rowId: update.row.id, field: update.field, value: update.value }];
  };

  const buildEditsForStopDurationUpdate = (update: StopDurationUpdate): PendingEdit[] => {
    const propagationResult = propagateStopDuration(update, selectedTrain, scenario.timetable_type);
    // If there is nothing to propagate, the typed value is the only edit
    return propagationResult
      ? propagationToEdits(propagationResult, rows)
      : [
          {
            rowId: update.row.id,
            field: update.field,
            value: update.value !== null ? new Duration({ seconds: update.value }) : null,
          },
        ];
  };

  const buildEditsForMarginUpdate = (
    editedRow: TimesStopsRow,
    requestedMargin: MarginValue | null
  ): PendingEdit[] => {
    const edits: PendingEdit[] = [
      { rowId: editedRow.id, field: 'requestedTheoreticalMargin', value: requestedMargin },
    ];

    const editedIndex = rows.findIndex((r) => r.id === editedRow.id);
    if (editedIndex === -1) return edits;

    for (let i = editedIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.isTheoreticalMarginBoundary) break;
      edits.push({
        rowId: row.id,
        field: 'requestedTheoreticalMargin',
        value: requestedMargin,
      });
    }

    return edits;
  };

  const handleArrivalChange = (
    row: TimesStopsRow,
    arrival: StartTime | null,
    propagationMode: PropagationMode
  ) => {
    commitEdit(
      buildEditsForRequestedTimesUpdate({
        row,
        field: 'requestedArrival',
        value: arrival,
        propagationMode,
      }),
      () => updateArrival(row, arrival, propagationMode)
    );
  };

  const handleDepartureChange = (
    row: TimesStopsRow,
    departure: StartTime | null,
    propagationMode: PropagationMode
  ) => {
    commitEdit(
      buildEditsForRequestedTimesUpdate({
        row,
        field: 'requestedDeparture',
        value: departure,
        propagationMode,
      }),
      () => updateDeparture(row, departure, propagationMode)
    );
  };

  const handleStopDurationChange = (
    row: TimesStopsRow,
    durationSeconds: number | null,
    propagationMode: StopPropagationMode
  ) => {
    commitEdit(
      buildEditsForStopDurationUpdate({
        row,
        field: 'stopDuration',
        value: durationSeconds,
        propagationMode,
      }),
      () => updateStopDuration(row, durationSeconds, propagationMode)
    );
  };

  const handleReceptionSignalChange = (row: TimesStopsRow, signal: ReceptionSignal | undefined) =>
    commitEdit([{ rowId: row.id, field: 'receptionSignal', value: signal }], () =>
      updateReceptionSignal(row, signal)
    );

  const handleRequestedMarginChange = (row: TimesStopsRow, requestedMargin: MarginValue | null) =>
    commitEdit(buildEditsForMarginUpdate(row, requestedMargin), () =>
      updateRequestedMargin(row, requestedMargin)
    );

  const handlePowerRestrictionChange = (row: TimesStopsRow, value: string | null) =>
    commitEdit([{ rowId: row.id, field: 'powerRestriction', value }], () =>
      updatePowerRestrictions(row, value)
    );

  const handleApplyTimesFromSimulation = (field: RequestedTimeField, mode: TimeFillMode): void => {
    const computedField = field === 'requestedArrival' ? 'computedArrival' : 'computedDeparture';
    const targetRows = getRowsToUpdateFromSimulation(rows, field, mode);
    const edits: PendingEdit[] = targetRows.map((row) => ({
      rowId: row.id,
      field,
      value: row[computedField],
    }));
    commitEdit(edits, () => updateMultipleTimes(targetRows, field));
  };

  return (
    <TimesStopsTable
      rows={optimisticRows}
      startTime={startTime}
      isValid={stableIsValid}
      isComputedDataPending={isAwaitingSimulation}
      availablePowerRestrictions={availablePowerRestrictions}
      powerRestrictionWarningCount={powerRestrictionWarningCount}
      powerRestrictionBlocks={powerRestrictionBlocks}
      onArrivalChange={handleArrivalChange}
      onStopDurationChange={handleStopDurationChange}
      onDepartureChange={handleDepartureChange}
      onReceptionSignalChange={handleReceptionSignalChange}
      onRequestedMarginChange={handleRequestedMarginChange}
      onPowerRestrictionChange={handlePowerRestrictionChange}
      onApplyTimesFromSimulation={handleApplyTimesFromSimulation}
    />
  );
};

export default TimeStopsTableWrapper;
