import {
  isPointPickingElement,
  isSegmentPickingElement,
  type HoveredItem,
  type SpaceTimeChartProps,
} from '@osrd-project/ui-charts';
import dayjs from 'dayjs';

import type { TrainId } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import type { AppDispatch } from 'store';
import {
  extractOccurrenceIndexFromOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
  isTrainId,
} from 'utils/trainId';

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
      dispatch(updateSelectedTrainId(draggedTrain.id));

      const timeDiff = payload.data.time - payload.initialData.time;

      let newDepartureTime = new Date(initialDepartureTime.getTime() + timeDiff);
      let draggedTrainId = draggedTrain.id;

      // if the dragged train is an occurrence, we need to update the first occurrence because the others are based on it
      if (isOccurrenceId(draggedTrain.id)) {
        const occurrencesIndex = extractOccurrenceIndexFromOccurrenceId(draggedTrain.id);
        const pacedTrainId = extractPacedTrainIdFromOccurrenceId(draggedTrain.id);
        const firstOccurrence = projectPathTrainResult.find(
          ({ id }) => isOccurrenceId(id) && extractPacedTrainIdFromOccurrenceId(id) === pacedTrainId
        );
        if (firstOccurrence && 'paced' in firstOccurrence) {
          newDepartureTime = dayjs(newDepartureTime)
            .add(occurrencesIndex * -firstOccurrence.paced.interval.ms, 'ms')
            .toDate();
          if (isOccurrenceId(firstOccurrence.id)) {
            draggedTrainId = firstOccurrence.id;
          }
        }
      }

      // stop dragging if necessary
      if (!isPanning) {
        setDraggingState(undefined);
      }

      await handleTrainDrag({
        draggedTrainId,
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
      const train = projectPathTrainResult.find(
        (projectedTrain) => projectedTrain.id === hoveredTrainId
      );
      // Only set dragging state if train is an occurrence (IndividualTrainProjection)
      if (train && isOccurrenceId(train.id)) {
        setDraggingState({
          draggedTrain: train as IndividualTrainProjection,
          initialDepartureTime: train.departureTime,
        });
      }
    }

    // if no hovered train, we pan normally
    spaceTimeChartOnPan?.(payload);

    if (isPanning !== previousPanning) {
      setPreviousPanning(isPanning);
    }
  };
}
