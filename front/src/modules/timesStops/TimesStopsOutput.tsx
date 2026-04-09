import { useEffect, useMemo, useRef, useState } from 'react';

import cx from 'classnames';
import { useSelector } from 'react-redux';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  CorePathfindingResultSuccess,
  ReceptionSignal,
  RollingStock,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import type { SimulationSummary, TimetableItemWithDetails } from 'modules/timetableItem/types';
import type { TimetableItem, Train } from 'reducers/osrdconf/types';
import { getUseNewTimesStopsTable } from 'reducers/user/userSelectors';
import { formatLocalTime } from 'utils/date';
import { Duration } from 'utils/duration';

import { computeOptimisticRow, propagationToEdits } from './helpers/cellUpdate';
import { computePowerRestrictionWarnings } from './helpers/powerRestrictionIncompatibility';
import { propagateTime } from './helpers/timePropagation';
import useOutputTableData from './hooks/useOutputTableData';
import useTimesStopsTableData from './hooks/useTimesStopsTableData';
import useUpdateTimesStopsTable from './hooks/useUpdateTimesStopsTable';
import TimesStops from './TimesStops';
import TimesStopsTable from './TimesStopsTable';
import {
  TableType,
  type CellUpdate,
  type PendingEdit,
  type PropagationMode,
  type MarginValue,
  type TimesStopsRow,
  type TimesStopsRowNew,
  type UpdateCellStatus,
} from './types';

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
  voltages?: PathPropertiesFormatted['voltages'];
  isSimulationDataLoading?: boolean;
  rollingStock?: RollingStock;
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
  voltages,
  isSimulationDataLoading = false,
  rollingStock,
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

  // The single source of truth for what the table displays. Any derived data fed to
  // TimesStopsTable (warnings, styling, etc.) should be computed from optimisticRows,
  // not from selectedTrain, to stay in sync with the displayed values during edits.
  const optimisticRows = useMemo(() => {
    if (!optimisticEdits) return newRows;
    const editMap = new Map(optimisticEdits.map((e) => [e.rowId, e]));
    return newRows.map((row) => {
      const edit = editMap.get(row.id);
      return edit ? { ...row, ...computeOptimisticRow(row, edit) } : row;
    });
  }, [newRows, optimisticEdits]);

  const startTime = useMemo(() => new Date(selectedTrain.start_time), [selectedTrain.start_time]);

  const availablePowerRestrictions = useMemo(
    () => Object.keys(rollingStock?.power_restrictions ?? {}),
    [rollingStock]
  );

  const { blocks: powerRestrictionBlocks, warningCount: powerRestrictionWarningCount } = useMemo(
    () =>
      computePowerRestrictionWarnings({
        rows: optimisticRows,
        path: selectedTrain.path,
        operationalPointsOnPath,
        voltages,
        rollingStock,
      }),
    [optimisticRows, voltages, selectedTrain.path, operationalPointsOnPath, rollingStock]
  );

  const {
    updateArrival,
    updateStopDuration,
    updateDeparture,
    updateReceptionSignal,
    updateRequestedMargin,
    updatePowerRestrictions,
  } = useUpdateTimesStopsTable(
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

  const buildEditsForUpdate = (
    singleEdit: PendingEdit,
    update: CellUpdate & { propagationMode: PropagationMode }
  ): PendingEdit[] => {
    const propagationResult = propagateTime(update, selectedTrain);
    return [
      singleEdit,
      ...(propagationResult
        ? propagationToEdits(propagationResult, newRows).filter((e) => e.rowId !== singleEdit.rowId)
        : []),
    ];
  };

  const buildEditsForMarginUpdate = (
    editedRow: TimesStopsRowNew,
    requestedMargin: MarginValue | null
  ): PendingEdit[] => {
    const edits: PendingEdit[] = [
      { rowId: editedRow.id, field: 'requestedTheoreticalMargin', value: requestedMargin },
    ];

    const editedIndex = newRows.findIndex((r) => r.id === editedRow.id);
    if (editedIndex === -1) return edits;

    for (let i = editedIndex + 1; i < newRows.length; i++) {
      const row = newRows[i];
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

  const handleStopDurationChange = (row: TimesStopsRowNew, durationSeconds: number | null) =>
    commitEdit(
      [
        {
          rowId: row.id,
          field: 'stopDuration',
          value: durationSeconds !== null ? new Duration({ seconds: durationSeconds }) : null,
        },
      ],
      () => updateStopDuration(row, durationSeconds)
    );

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

  if (useNewTimesStopsTable) {
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
