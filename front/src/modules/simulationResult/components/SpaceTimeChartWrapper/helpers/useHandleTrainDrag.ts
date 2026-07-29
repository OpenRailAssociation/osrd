import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import { updatePacedTrainExceptionsList } from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/helpers/buildPacedTrainException';
import type { TrainSpaceTimeData } from 'modules/simulationResult/types';
import {
  findExceptionWithOccurrenceId,
  shiftPacedExceptions,
} from 'modules/trainSchedule/helpers/pacedTrain';
import type { SimulatedException } from 'modules/trainSchedule/types';
import type { OccurrenceId, TrainId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import {
  extractEditoastIdFromTrainScheduleId,
  extractOccurrenceIndexFromOccurrenceId,
  extractTrainScheduleIdFromOccurrenceId,
  isIndexedOccurrenceId,
  isOccurrenceId,
} from 'utils/trainId';

import type { PanelSelectionMode } from '../CurveSelectionSidePanel';

type DragDeps = {
  setTrainScheduleProjections: (newProjections: TrainSpaceTimeData[]) => void;
  handleTrainDragInTrackOccupancy: (args: {
    draggedTrainId: TrainId;
    selectionMode: PanelSelectionMode;
    newTrainData: TrainSpaceTimeData;
    offset: Duration;
    stopPanning: boolean;
  }) => Promise<void>;
};

/** Per-drag context shared by every mode handler. */
type DragContext = DragDeps & {
  draggedTrain: TrainSpaceTimeData;
  updateTrainScheduleDepartureTime: (
    draggedTrainId: TrainId,
    newDepartureTime: Date,
    panelSelectionMode?: PanelSelectionMode
  ) => Promise<void>;
  /** Returns the full projections array with the dragged train replaced by `updated`. */
  replaceProjection: (updated: TrainSpaceTimeData) => TrainSpaceTimeData[];
  newDepartureTime: Date;
  initialDepartureTime: Date;
  stopPanning: boolean;
  /** Exceptions captured at drag start — stable base so repeated frames don't accumulate. */
  originalPacedExceptions?: SimulatedException[];
};

/** single mode: move one occurrence through its own start_time exception. */
async function handleSingleOccurrenceDrag({
  setTrainScheduleProjections,
  handleTrainDragInTrackOccupancy,
  updateTrainScheduleDepartureTime,
  draggedTrain,
  replaceProjection,
  draggedTrainId,
  newDepartureTime,
  initialDepartureTime,
  stopPanning,
  originalPacedExceptions,
}: DragContext & { draggedTrainId: OccurrenceId }) {
  if (!draggedTrain.paced) return;

  const baseExceptions = originalPacedExceptions ?? draggedTrain.paced.exceptions;
  const isUnchanged = newDepartureTime.getTime() === initialDepartureTime.getTime();
  let previewExceptions = baseExceptions;
  if (!isUnchanged) {
    const existingException = findExceptionWithOccurrenceId(baseExceptions, draggedTrainId);
    const occurrenceIndex = isIndexedOccurrenceId(draggedTrainId)
      ? extractOccurrenceIndexFromOccurrenceId(draggedTrainId)
      : undefined;
    const previewException: SimulatedException = {
      ...(existingException ?? { key: '', occurrence_index: occurrenceIndex }),
      start_time: { value: newDepartureTime.getTime() },
    };
    previewExceptions = updatePacedTrainExceptionsList(
      baseExceptions,
      previewException,
      draggedTrainId
    );
  }

  const previewTrain: TrainSpaceTimeData = {
    ...draggedTrain,
    paced: { ...draggedTrain.paced, exceptions: previewExceptions },
  };

  // Register the train as "being dragged" (stopPanning: false) so the trains-update effect in
  // useTrackOccupancy skips it instead of refetching its occupancy on every frame.
  const offset = Duration.subtractDate(newDepartureTime, initialDepartureTime);
  await handleTrainDragInTrackOccupancy({
    draggedTrainId,
    selectionMode: 'single',
    stopPanning: false,
    offset,
    newTrainData: previewTrain,
  });
  setTrainScheduleProjections(replaceProjection(previewTrain));

  if (!stopPanning) return;

  // On drop, updateTrainScheduleDepartureTime creates/updates/deletes the occurrence exception
  // and reconciles the local state (timetable, simulation and projection stores). Skip it when
  // the occurrence was dragged back onto its own pre-drag time — nothing actually changed.
  if (!isUnchanged) {
    await updateTrainScheduleDepartureTime(draggedTrainId, newDepartureTime, 'single');
  }
  await handleTrainDragInTrackOccupancy({
    draggedTrainId,
    selectionMode: 'single',
    stopPanning: true,
    offset,
    newTrainData: previewTrain,
  });
}

/** all mode: move the model and every start_time exception by the same offset. */
async function handleAllOccurrencesDrag({
  setTrainScheduleProjections,
  handleTrainDragInTrackOccupancy,
  updateTrainScheduleDepartureTime,
  draggedTrain,
  replaceProjection,
  draggedTrainId,
  newDepartureTime,
  initialDepartureTime,
  stopPanning,
  originalPacedExceptions,
}: DragContext & { draggedTrainId: OccurrenceId }) {
  if (!draggedTrain.paced) return;

  // initialDepartureTime is the model departure at drag start, so the offset is absolute
  // (no per-frame accumulation). The exceptions are shifted from their captured originals.
  const offset = Duration.subtractDate(newDepartureTime, initialDepartureTime);
  const baseExceptions = originalPacedExceptions ?? draggedTrain.paced.exceptions;
  const newTrainData: TrainSpaceTimeData = {
    ...draggedTrain,
    departureTime: newDepartureTime,
    paced: { ...draggedTrain.paced, exceptions: shiftPacedExceptions(baseExceptions, offset) },
  };

  await handleTrainDragInTrackOccupancy({
    draggedTrainId,
    selectionMode: 'all',
    stopPanning: false,
    offset,
    newTrainData,
  });
  setTrainScheduleProjections(replaceProjection(newTrainData));

  if (!stopPanning) return;

  // updateTrainScheduleDepartureTime in 'all' mode also persists the shifted exceptions. Skip it
  // when the model was dragged back onto its own pre-drag departure — nothing actually changed.
  if (offset.ms !== 0) {
    await updateTrainScheduleDepartureTime(draggedTrainId, newDepartureTime, 'all');
  }
  await handleTrainDragInTrackOccupancy({
    draggedTrainId,
    selectionMode: 'all',
    stopPanning: true,
    offset,
    newTrainData,
  });
}

/** compliant mode & non-paced trains: move the model departure. */
async function handleModelDrag({
  setTrainScheduleProjections,
  handleTrainDragInTrackOccupancy,
  updateTrainScheduleDepartureTime,
  draggedTrain,
  replaceProjection,
  draggedTrainId,
  newDepartureTime,
  initialDepartureTime,
  stopPanning,
}: DragContext & { draggedTrainId: TrainId }) {
  const newTrainData: TrainSpaceTimeData = { ...draggedTrain, departureTime: newDepartureTime };

  const offset = Duration.subtractDate(newDepartureTime, initialDepartureTime);
  await handleTrainDragInTrackOccupancy({
    draggedTrainId,
    selectionMode: 'compliant',
    stopPanning: false,
    offset,
    newTrainData,
  });
  setTrainScheduleProjections(replaceProjection(newTrainData));

  if (!stopPanning) return;

  // Skip the persist call when the model was dragged back onto its own pre-drag departure —
  // nothing actually changed.
  if (newDepartureTime.getTime() !== initialDepartureTime.getTime()) {
    await updateTrainScheduleDepartureTime(draggedTrainId, newDepartureTime);
  }
  await handleTrainDragInTrackOccupancy({
    draggedTrainId,
    selectionMode: 'compliant',
    stopPanning: true,
    offset,
    newTrainData,
  });
}

export default function useHandleTrainDrag({
  trainScheduleProjections,
  ...deps
}: DragDeps & { trainScheduleProjections: TrainSpaceTimeData[] }) {
  const { updateTrainScheduleDepartureTime } = useTimetableContext();
  return async function handleTrainDrag({
    draggedTrainId,
    newDepartureTime,
    initialDepartureTime,
    stopPanning,
    panelSelectionMode,
    originalPacedExceptions,
  }: {
    draggedTrainId: TrainId;
    newDepartureTime: Date;
    initialDepartureTime: Date;
    stopPanning: boolean;
    panelSelectionMode: PanelSelectionMode;
    originalPacedExceptions?: SimulatedException[];
  }) {
    const draggedItemId = extractEditoastIdFromTrainScheduleId(
      isOccurrenceId(draggedTrainId)
        ? extractTrainScheduleIdFromOccurrenceId(draggedTrainId)
        : draggedTrainId
    );
    const draggedTrain = trainScheduleProjections.find((train) => train.id === draggedItemId);
    if (!draggedTrain) return;

    const context: DragContext = {
      ...deps,
      draggedTrain,
      updateTrainScheduleDepartureTime,
      replaceProjection: (updated) =>
        trainScheduleProjections.map((train) => (train.id === draggedItemId ? updated : train)),
      newDepartureTime,
      initialDepartureTime,
      stopPanning,
      originalPacedExceptions,
    };

    if (panelSelectionMode === 'single' && isOccurrenceId(draggedTrainId)) {
      return handleSingleOccurrenceDrag({ ...context, draggedTrainId });
    }
    if (panelSelectionMode === 'all' && isOccurrenceId(draggedTrainId)) {
      return handleAllOccurrencesDrag({ ...context, draggedTrainId });
    }
    return handleModelDrag({ ...context, draggedTrainId });
  };
}
