import { updatePacedTrainExceptionsList } from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/helpers/buildPacedTrainException';
import type { TrainSpaceTimeData } from 'modules/simulationResult/types';
import {
  findExceptionWithOccurrenceId,
  shiftPacedExceptions,
} from 'modules/trainSchedule/helpers/pacedTrain';
import type { SimulatedException } from 'modules/trainSchedule/types';
import type { OccurrenceId, TrainId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromPacedTrainId,
  extractOccurrenceIndexFromOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  isIndexedOccurrenceId,
  isOccurrenceId,
} from 'utils/trainId';

import type { PanelSelectionMode } from '../CurveSelectionSidePanel';

type DragDeps = {
  setTrainScheduleProjections: (newProjections: TrainSpaceTimeData[]) => void;
  handleTrainDragInTrackOccupancy: (args: {
    draggedTrainId: TrainId;
    newTrainData: TrainSpaceTimeData;
    initialDepartureTime: Date;
    stopPanning: boolean;
  }) => Promise<void>;
  updateTrainScheduleDepartureTime: (
    draggedTrainId: TrainId,
    newDepartureTime: Date,
    panelSelectionMode?: PanelSelectionMode
  ) => Promise<void>;
};

/** Per-drag context shared by every mode handler. */
type DragContext = DragDeps & {
  draggedTrain: TrainSpaceTimeData;
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
  stopPanning,
  originalPacedExceptions,
}: DragContext & { draggedTrainId: OccurrenceId }) {
  if (!draggedTrain.paced) return;

  const baseExceptions = originalPacedExceptions ?? draggedTrain.paced.exceptions;
  const existingException = findExceptionWithOccurrenceId(baseExceptions, draggedTrainId);
  const occurrenceIndex = isIndexedOccurrenceId(draggedTrainId)
    ? extractOccurrenceIndexFromOccurrenceId(draggedTrainId)
    : undefined;

  // Live feedback: show the occurrence at the dragged position (keep its other overrides).
  const previewException: SimulatedException = {
    ...(existingException ?? { key: '', occurrence_index: occurrenceIndex }),
    start_time: { value: newDepartureTime.getTime() },
  };
  const previewTrain: TrainSpaceTimeData = {
    ...draggedTrain,
    paced: {
      ...draggedTrain.paced,
      exceptions: updatePacedTrainExceptionsList(baseExceptions, previewException, draggedTrainId),
    },
  };

  // Register the train as "being dragged" (stopPanning: false) so the trains-update effect in
  // useTrackOccupancy skips it instead of refetching its occupancy on every frame.
  await handleTrainDragInTrackOccupancy({
    draggedTrainId,
    stopPanning: false,
    initialDepartureTime: draggedTrain.departureTime,
    newTrainData: previewTrain,
  });
  setTrainScheduleProjections(replaceProjection(previewTrain));

  if (!stopPanning) return;

  // On drop, updateTrainScheduleDepartureTime creates/updates/deletes the occurrence exception
  // and reconciles the local state (timetable, simulation and projection stores).
  await updateTrainScheduleDepartureTime(draggedTrainId, newDepartureTime, 'single');
  await handleTrainDragInTrackOccupancy({
    draggedTrainId,
    stopPanning: true,
    initialDepartureTime: draggedTrain.departureTime,
    newTrainData: previewTrain,
  });
}

export default function createHandleTrainDrag({
  trainScheduleProjections,
  ...deps
}: DragDeps & { trainScheduleProjections: TrainSpaceTimeData[] }) {
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
    const draggedItemId = extractEditoastIdFromPacedTrainId(
      isOccurrenceId(draggedTrainId)
        ? extractPacedTrainIdFromOccurrenceId(draggedTrainId)
        : draggedTrainId
    );
    const draggedTrain = trainScheduleProjections.find((train) => train.id === draggedItemId);
    if (!draggedTrain) return;

    const context: DragContext = {
      ...deps,
      draggedTrain,
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
  };
}
