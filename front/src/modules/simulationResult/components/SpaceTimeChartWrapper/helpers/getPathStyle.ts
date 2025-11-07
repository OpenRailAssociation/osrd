import type { PathLevel, HoveredItem } from '@osrd-project/ui-charts';

import type { CategoryColors } from 'applications/operationalStudies/types';
import type { TrainId } from 'reducers/osrdconf/types';
import { extractPacedTrainIdFromOccurrenceId, isOccurrenceId } from 'utils/trainId';

const getPathStyle = (
  hovered: HoveredItem | null,
  train: { colors: CategoryColors; id: string },
  dragging: boolean,
  selectedTrainId?: TrainId
): {
  color: string;
  level?: PathLevel;
  border?: {
    offset: number;
    color: string;
    width?: number;
    backgroundColor?: string;
  };
} => {
  const timetableItemId = isOccurrenceId(train.id)
    ? extractPacedTrainIdFromOccurrenceId(train.id)
    : train.id;
  const { colors } = train;

  if (hovered && 'pathId' in hovered.element && !dragging) {
    const hoveredTrainId = hovered.element.pathId as TrainId;

    if (
      train.id === hoveredTrainId ||
      // if the hovered train is an occurrence from the same paced train, apply the hovered style
      (isOccurrenceId(hoveredTrainId) &&
        timetableItemId === extractPacedTrainIdFromOccurrenceId(hoveredTrainId))
    ) {
      return { color: colors.hovered, level: 1 };
    }
  }
  // Apply occurrence style if selectedTrainId is an occurrence from the same paced
  if (selectedTrainId) {
    if (isOccurrenceId(selectedTrainId)) {
      if (train.id === selectedTrainId) {
        return {
          color: colors.normal,
          level: 1,
          border: {
            offset: 3,
            width: 0.5,
            color: colors.normal,
            backgroundColor: colors.background,
          },
        };
      }
      // Other occurrences from the same paced
      if (
        isOccurrenceId(train.id) &&
        extractPacedTrainIdFromOccurrenceId(train.id) ===
          extractPacedTrainIdFromOccurrenceId(selectedTrainId)
      ) {
        return {
          color: colors.normal,
          level: 1,
          border: {
            offset: 3.5,
            color: 'transparent',
            backgroundColor: colors.background,
          },
        };
      }
    } else if (train.id === selectedTrainId) {
      return { color: colors.normal, level: 1 };
    }
  }

  return { color: colors.normal };
};

export default getPathStyle;
