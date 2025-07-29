import {
  isPointPickingElement,
  isSegmentPickingElement,
  type HoveredItem,
} from '@osrd-project/ui-charts';

import { isOccurrenceProjection, isTrainId } from 'utils/trainId';

import type { DraggingState, IndividualTrainProjection } from '../types';

export default function makeDraggingState(
  hoveredItem: HoveredItem,
  projectedTrains: IndividualTrainProjection[]
): DraggingState | null {
  if (
    !isSegmentPickingElement(hoveredItem.element) &&
    !isPointPickingElement(hoveredItem.element)
  ) {
    throw new Error('wrong hoveredItem type');
  }

  const hoveredTrainId = hoveredItem.element.pathId;
  if (!isTrainId(hoveredTrainId)) {
    throw new Error('hovered train id should be a train schedule id or an occurrence id');
  }
  const individualTrainProjection = projectedTrains.find(
    (projectedTrain) => projectedTrain.id === hoveredTrainId
  );

  if (!individualTrainProjection) {
    console.error(`No train found with id ${hoveredTrainId}`);
    return null;
  }
  if (isOccurrenceProjection(individualTrainProjection)) {
    if (individualTrainProjection && individualTrainProjection.isStartTimeException) {
      return null;
    }
    return {
      draggedTrain: individualTrainProjection,
      initialDepartureTime: individualTrainProjection.pacedTrainDepartureTime,
    };
  }

  return {
    draggedTrain: individualTrainProjection,
    initialDepartureTime: individualTrainProjection.departureTime,
  };
}
