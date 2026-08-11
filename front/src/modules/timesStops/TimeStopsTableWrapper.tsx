import { useEffect, useMemo, useRef, useState } from 'react';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  CorePathfindingResultSuccess,
  ReceptionSignal,
  RollingStock,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import type { SimulationSummary, TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { Train } from 'reducers/osrdconf/types';
import { Duration, addDurationToDate } from 'utils/duration';

import { computeOptimisticRow, propagationToEdits } from './helpers/cellUpdate';
import { computePowerRestrictionWarnings } from './helpers/powerRestrictionIncompatibility';
import { propagateStopDuration } from './helpers/stopDurationPropagation';
import { ONE_DAY, propagateTime } from './helpers/timePropagation';
import useTimesStopsTableData from './hooks/useTimesStopsTableData';
import useUpdateTimesStopsTable from './hooks/useUpdateTimesStopsTable';
import TimesStopsTable from './TimesStopsTable';
import {
  type CellUpdate,
  type PendingEdit,
  type PropagationMode,
  type StopDurationUpdate,
  type StopPropagationMode,
  type MarginValue,
  type TimesStopsRowNew,
  type UpdateCellStatus,
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

const bumpMidnightCrossings = (rows: TimesStopsRowNew[]): TimesStopsRowNew[] => {
  let lastArrival: Date | null = null;
  return rows.map((row) => {
    if (row.requestedArrival === null) return row;
    if (lastArrival !== null && row.requestedArrival < lastArrival) {
      const bumped = addDurationToDate(row.requestedArrival, ONE_DAY);
      lastArrival = bumped;
      return {
        ...row,
        requestedArrival: bumped,
        requestedDeparture:
          row.requestedDeparture !== null
            ? addDurationToDate(row.requestedDeparture, ONE_DAY)
            : null,
      };
    }
    lastArrival = row.requestedArrival;
    return row;
  });
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
  } | null>(null);

  const optimisticEdits =
    pinnedState !== null &&
    pinnedState.forSchedule === selectedTrain.schedule &&
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
    let copyRows: TimesStopsRowNew[] = rows;
    if (optimisticEdits) {
      const editMap = new Map(optimisticEdits.map((e): [string, PendingEdit] => [e.rowId, e]));
      copyRows = rows.map((row) => {
        const edit = editMap.get(row.id);
        return edit ? { ...row, ...computeOptimisticRow(row, edit) } : row;
      });
    }

    return bumpMidnightCrossings(copyRows);
  }, [rows, optimisticEdits]);

  const startTime = useMemo(() => new Date(selectedTrain.start_time), [selectedTrain.start_time]);

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

  // Origin arrival = start_time (not in schedule), so propagationToEdits misses it.
  const computeOriginEdits = (updatedStartTime: Date): PendingEdit[] => {
    const originRow = rows.at(0);
    return originRow && originRow.requestedArrival?.getTime() !== updatedStartTime.getTime()
      ? [{ rowId: originRow.id, field: 'requestedArrival', value: updatedStartTime }]
      : [];
  };

  const buildEditsForUpdate = (
    singleEdit: PendingEdit,
    update: CellUpdate & { propagationMode: PropagationMode }
  ): PendingEdit[] => {
    const propagationResult = propagateTime(update, selectedTrain);
    if (!propagationResult) return [singleEdit];

    const propagationEdits = propagationToEdits(propagationResult, rows);
    const originEdits = computeOriginEdits(propagationResult.updatedStartTime);

    // When editing the origin, originEdits already has the correct date.
    // singleEdit must be skipped because the typed value can carry the
    // wrong calendar day (the input only captures HH:mm:ss, not the date).
    const editedRowIsOrigin = originEdits.some((e) => e.rowId === singleEdit.rowId);

    if (update.propagationMode === 'shiftAllWaypoints' || editedRowIsOrigin) {
      return [...originEdits, ...propagationEdits];
    }

    return [
      ...originEdits,
      singleEdit,
      ...propagationEdits.filter((e) => e.rowId !== singleEdit.rowId),
    ];
  };

  const buildEditsForStopDurationUpdate = (
    singleEdit: PendingEdit,
    update: StopDurationUpdate
  ): PendingEdit[] => {
    const propagationResult = propagateStopDuration(update, selectedTrain);
    if (!propagationResult) return [singleEdit];

    const propagationEdits = propagationToEdits(propagationResult, rows);
    const originEdits = computeOriginEdits(propagationResult.updatedStartTime);

    const editedRowArrivalEdit = propagationEdits.find(
      (edit): edit is PendingEdit & { field: 'requestedArrival' } =>
        edit.rowId === singleEdit.rowId && edit.field === 'requestedArrival'
    );
    const editedRowEdit: PendingEdit = editedRowArrivalEdit
      ? {
          rowId: singleEdit.rowId,
          field: 'stopDurationWithArrival',
          value: {
            stop: update.value,
            arrival: editedRowArrivalEdit.value ?? propagationResult.updatedStartTime,
          },
        }
      : singleEdit;

    return [
      ...originEdits,
      editedRowEdit,
      ...propagationEdits.filter((e) => e.rowId !== singleEdit.rowId),
    ];
  };

  const buildEditsForMarginUpdate = (
    editedRow: TimesStopsRowNew,
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
    row: TimesStopsRowNew,
    arrival: Date | null,
    propagationMode: PropagationMode
  ) => {
    const singleEdit: PendingEdit = { rowId: row.id, field: 'requestedArrival', value: arrival };
    commitEdit(
      buildEditsForUpdate(singleEdit, {
        row,
        field: 'requestedArrival',
        value: arrival,
        propagationMode,
      }),
      () => updateArrival(row, arrival, propagationMode)
    );
  };

  const handleDepartureChange = (
    row: TimesStopsRowNew,
    departure: Date | null,
    propagationMode: PropagationMode
  ) => {
    const singleEdit: PendingEdit = {
      rowId: row.id,
      field: 'requestedDeparture',
      value: departure,
    };
    commitEdit(
      buildEditsForUpdate(singleEdit, {
        row,
        field: 'requestedDeparture',
        value: departure,
        propagationMode,
      }),
      () => updateDeparture(row, departure, propagationMode)
    );
  };

  const handleStopDurationChange = (
    row: TimesStopsRowNew,
    duration: Duration | null,
    propagationMode: StopPropagationMode
  ) => {
    const singleEdit: PendingEdit = {
      rowId: row.id,
      field: 'stopDuration',
      value: duration,
    };
    commitEdit(
      buildEditsForStopDurationUpdate(singleEdit, {
        row,
        field: 'stopDuration',
        value: duration,
        propagationMode,
      }),
      () => updateStopDuration(row, duration, propagationMode)
    );
  };

  const handleReceptionSignalChange = (
    row: TimesStopsRowNew,
    signal: ReceptionSignal | undefined
  ) =>
    commitEdit([{ rowId: row.id, field: 'receptionSignal', value: signal }], () =>
      updateReceptionSignal(row, signal)
    );

  const handleRequestedMarginChange = (
    row: TimesStopsRowNew,
    requestedMargin: MarginValue | null
  ) =>
    commitEdit(buildEditsForMarginUpdate(row, requestedMargin), () =>
      updateRequestedMargin(row, requestedMargin)
    );

  const handlePowerRestrictionChange = (row: TimesStopsRowNew, value: string | null) =>
    commitEdit([{ rowId: row.id, field: 'powerRestriction', value }], () =>
      updatePowerRestrictions(row, value)
    );

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
    />
  );
};

export default TimeStopsTableWrapper;
