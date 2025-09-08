import {
  isPointPickingElement,
  isSegmentPickingElement,
  type HoveredItem,
  type SpaceTimeChartProps,
} from '@osrd-project/ui-charts';

import type { TrainId } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import type { AppDispatch } from 'store';
import { Duration, subtractDurationFromDate } from 'utils/duration';
import {
  extractOccurrenceIndexFromOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  isPacedTrainId,
  isTrainId,
} from 'utils/trainId';

import { isIndividualOccurrenceProjection } from './utils';
import type { IndividualTrainProjection, TrainSpaceTimeData } from '../../../types';

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
  projectPathTrainResult: TrainSpaceTimeData[];
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
  projectPathTrainResult,
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
        dispatch(updateSelectedTrainId(draggedTrain.id));
      }

      const timeDiff = payload.data.time - payload.initialData.time;

      let newDepartureTime = new Date(initialDepartureTime.getTime() + timeDiff);

      // if the dragged train is an occurrence, we need to update the first occurrence because the others are based on it
      if (
        isIndividualOccurrenceProjection(draggedTrain) &&
        (!draggedTrain.exception || !draggedTrain.exception.start_time)
      ) {
        const occurrencesIndex = extractOccurrenceIndexFromOccurrenceId(draggedTrain.id);
        const pacedTrainId = extractPacedTrainIdFromOccurrenceId(draggedTrain.id);
        const pacedTrain = projectPathTrainResult.find(
          ({ id }) => isPacedTrainId(id) && id === pacedTrainId
        );
        if (pacedTrain && 'paced' in pacedTrain) {
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
      const isStartTimeException =
        isIndividualOccurrenceProjection(train) && !!train.exception?.start_time;
      if (isStartTimeException) return;

      setDraggingState({
        draggedTrain: train,
        initialDepartureTime: train.departureTime,
      });
    }

    // if no hovered train, we pan normally
    spaceTimeChartOnPan?.(payload);

    if (isPanning !== previousPanning) {
      setPreviousPanning(isPanning);
    }
  };
}
