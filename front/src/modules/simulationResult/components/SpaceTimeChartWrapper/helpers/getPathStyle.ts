import type { PathLevel, HoveredItem } from '@osrd-project/ui-charts';

import type { CategoryColors } from 'applications/operationalStudies/types';
import type { TrainScheduleId, TrainId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromTrainScheduleId,
  extractTrainScheduleIdFromOccurrenceId,
  isOccurrenceId,
  isTrainScheduleId,
} from 'utils/trainId';

const getPathStyle = (
  hovered: HoveredItem | null,
  train: { colors: CategoryColors; id: string; isSimulated?: boolean },
  dragging: boolean,
  selectedTrainId?: TrainId,
  hoveredTrainIdFromTimetable?: TrainId
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
  let trainScheduleId: TrainScheduleId;
  if (isOccurrenceId(train.id)) {
    trainScheduleId = extractTrainScheduleIdFromOccurrenceId(train.id);
  } else {
    if (!isTrainScheduleId(train.id)) throw new Error();
    trainScheduleId = train.id;
  }
  const editoastId = extractEditoastIdFromTrainScheduleId(trainScheduleId);
  const { colors } = train;

  const invalidBorder = {
    offset: 16,
    color: 'transparent',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  };

  // Check hover from chart
  if (hovered && 'pathId' in hovered.element && !dragging) {
    const hoveredTrainIdFromChart = hovered.element.pathId as TrainId;

    if (
      train.id === hoveredTrainIdFromChart ||
      // if the hovered train is an occurrence from the same paced train, apply the hovered style
      (isOccurrenceId(hoveredTrainIdFromChart) &&
        editoastId ===
          extractEditoastIdFromTrainScheduleId(
            extractTrainScheduleIdFromOccurrenceId(hoveredTrainIdFromChart)
          ))
    ) {
      return {
        color: colors.strong,
        level: 1,
        ...(train.isSimulated === false && { border: invalidBorder }),
      };
    }
  }

  // Check hover from timetable
  if (hoveredTrainIdFromTimetable && !dragging) {
    // When hovering from the timetable list:
    // - if we hover an occurrence, we only highlight that exact occurrence curve
    // - if we hover a paced train (collapsed or expanded header), we highlight all its occurrences
    if (isOccurrenceId(hoveredTrainIdFromTimetable)) {
      if (train.id === hoveredTrainIdFromTimetable) {
        return {
          color: colors.strong,
          level: 1,
          ...(train.isSimulated === false && { border: invalidBorder }),
        };
      }
    } else if (editoastId === extractEditoastIdFromTrainScheduleId(hoveredTrainIdFromTimetable)) {
      return {
        color: colors.strong,
        level: 1,
        ...(train.isSimulated === false && { border: invalidBorder }),
      };
    }
  }

  // Apply occurrence style if selectedTrainId is an occurrence from the same paced
  if (selectedTrainId) {
    if (isOccurrenceId(selectedTrainId)) {
      if (train.id === selectedTrainId) {
        return {
          color: colors.base,
          level: 1,
          border:
            train.isSimulated === false
              ? {
                  offset: 3,
                  width: 13,
                  color: 'rgba(0, 0, 0, 0.05)',
                  backgroundColor: colors.surface,
                }
              : {
                  offset: 3,
                  width: 0.5,
                  color: colors.base,
                  backgroundColor: colors.surface,
                },
        };
      }
      // Other occurrences from the same paced
      if (
        isOccurrenceId(train.id) &&
        extractTrainScheduleIdFromOccurrenceId(train.id) ===
          extractTrainScheduleIdFromOccurrenceId(selectedTrainId)
      ) {
        return {
          color: colors.base,
          level: 1,
          border:
            train.isSimulated === false
              ? invalidBorder
              : {
                  offset: 3.5,
                  color: 'transparent',
                  backgroundColor: colors.surface,
                },
        };
      }
    } else if (train.id === selectedTrainId) {
      return {
        color: colors.base,
        level: 1,
        ...(train.isSimulated === false && { border: invalidBorder }),
      };
    }
  }

  return {
    color: colors.base,
    ...(train.isSimulated === false && { border: invalidBorder }),
  };
};

export default getPathStyle;
