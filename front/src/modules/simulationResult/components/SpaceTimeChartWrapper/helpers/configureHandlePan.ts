import {
  isPointPickingElement,
  isSegmentPickingElement,
  isOccupancyPickingElement,
  type HoveredItem,
  type SpaceTimeChartProps,
} from '@osrd-project/ui-charts';

import type { TrainId } from 'reducers/osrdconf/types';
import { updateSelectedTrain } from 'reducers/simulationResults';
import type { AppDispatch } from 'store';
import { Duration, subtractDurationFromDate } from 'utils/duration';
import {
  extractEditoastIdFromPacedTrainId,
  extractOccurrenceIndexFromOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  isTrainId,
} from 'utils/trainId';

import type { IndividualTrainProjection, TrainSpaceTimeData } from '../../../types';
import { isIndividualOccurrenceProjection } from './utils';
import { parseOccupancyZonePathId, type OccupancyZoneReference } from './zones';

type DraggingState =
  | {
      draggedTrain: IndividualTrainProjection;
      initialDepartureTime: Date;
    }
  | undefined;

type ConfigureHandlePanParams = {
  spaceTimeChartOnPan?: SpaceTimeChartProps['onPan'];
  handleTrainDrag?: (args: {
    draggedTrainId: TrainId;
    initialDepartureTime: Date;
    newDepartureTime: Date;
    stopPanning: boolean;
  }) => Promise<void>;
  selectedTrainId?: TrainId;
  projectedTrains: IndividualTrainProjection[];
  draggingState: DraggingState;
  setDraggingState: (s: DraggingState) => void;
  hoveredItem: HoveredItem | null;
  previousPanning: boolean;
  setPreviousPanning: (v: boolean) => void;
  zoomMode: boolean;
  trainScheduleProjections: TrainSpaceTimeData[];
  occupancyZoneDragAndDrop?: {
    isDragging: boolean;
    onDragStart: (zoneRef: OccupancyZoneReference) => void;
    onDrop: () => void;
  };
  dispatch: AppDispatch;
};

export function configureHandlePan({
  spaceTimeChartOnPan,
  handleTrainDrag,
  selectedTrainId,
  projectedTrains,
  draggingState,
  setDraggingState,
  hoveredItem,
  previousPanning,
  setPreviousPanning,
  zoomMode,
  trainScheduleProjections,
  occupancyZoneDragAndDrop,
  dispatch,
}: ConfigureHandlePanParams): NonNullable<SpaceTimeChartProps['onPan']> {
  return async (payload) => {
    const { isPanning } = payload;

    if (!handleTrainDrag) {
      // if no handleTrainDrag, we pan normally
      spaceTimeChartOnPan?.(payload);
      return;
    }

    // If dragging
    if (draggingState) {
      const { draggedTrain, initialDepartureTime } = draggingState;

      if (draggedTrain.id !== selectedTrainId) {
        dispatch(updateSelectedTrain({ id: draggedTrain.id, by: 'std' }));
      }

      const timeDiff = payload.data.time - payload.initialData.time;

      let newDepartureTime = new Date(initialDepartureTime.getTime() + timeDiff);

      // if the dragged train is an occurrence, we need to update the first occurrence because the others are based on it
      if (
        isIndividualOccurrenceProjection(draggedTrain) &&
        (draggedTrain.type !== 'exception' || !draggedTrain.exception.start_time)
      ) {
        const occurrencesIndex = extractOccurrenceIndexFromOccurrenceId(draggedTrain.id);
        const pacedTrainId = extractEditoastIdFromPacedTrainId(
          extractPacedTrainIdFromOccurrenceId(draggedTrain.id)
        );
        const pacedTrain = trainScheduleProjections.find(({ id }) => id === pacedTrainId);
        if (pacedTrain?.paced) {
          newDepartureTime = subtractDurationFromDate(
            newDepartureTime,
            new Duration({ milliseconds: occurrencesIndex * pacedTrain.paced.interval.ms })
          );
        }
      }

      // stop dragging if necessary
      if (!isPanning) {
        setDraggingState(undefined);
      }

      await handleTrainDrag({
        draggedTrainId: draggedTrain.id,
        initialDepartureTime,
        newDepartureTime,
        stopPanning: !isPanning,
      });
      return;
    }

    // if not dragging, we check if we should start dragging
    // Only a mouse hover that starts already over a path should register
    // if we start panning, and then the mouse hovers over the path,
    // it should continue just sliding the chart, not start dragging the train path
    if (
      isPanning &&
      !previousPanning &&
      !zoomMode &&
      !occupancyZoneDragAndDrop?.isDragging &&
      hoveredItem &&
      (isSegmentPickingElement(hoveredItem.element) || isPointPickingElement(hoveredItem.element))
    ) {
      const hoveredTrainId = hoveredItem.element.pathId;
      if (!isTrainId(hoveredTrainId)) return;

      const train = projectedTrains.find((projectedTrain) => projectedTrain.id === hoveredTrainId);
      if (!train) {
        console.error(`No train found with id ${hoveredTrainId}`);
        return;
      }

      // disable start time exception for now
      const isStartTimeException = train.type === 'exception' && !!train.exception.start_time;
      if (isStartTimeException) return;

      setDraggingState({
        draggedTrain: train,
        initialDepartureTime: train.departureTime,
      });
    }

    if (occupancyZoneDragAndDrop) {
      if (
        isPanning &&
        !previousPanning &&
        !occupancyZoneDragAndDrop.isDragging &&
        !zoomMode &&
        hoveredItem &&
        isOccupancyPickingElement(hoveredItem.element)
      ) {
        occupancyZoneDragAndDrop.onDragStart(parseOccupancyZonePathId(hoveredItem.element.pathId));
        return;
      }

      if (occupancyZoneDragAndDrop?.isDragging) {
        if (!isPanning) {
          occupancyZoneDragAndDrop.onDrop();
        }
        return;
      }
    }

    // if no hovered train, we pan normally
    spaceTimeChartOnPan?.(payload);

    if (isPanning !== previousPanning) {
      setPreviousPanning(isPanning);
    }
  };
}
