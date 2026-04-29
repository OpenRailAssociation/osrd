import type { PathLevel, HoveredItem } from '@osrd-project/ui-charts';

import type { CategoryColors } from 'applications/operationalStudies/types';
import type { PacedTrainId, TrainId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
  isPacedTrainId,
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
  let pacedTrainId: PacedTrainId;
  if (isOccurrenceId(train.id)) {
    pacedTrainId = extractPacedTrainIdFromOccurrenceId(train.id);
  } else {
    if (!isPacedTrainId(train.id)) throw new Error();
    pacedTrainId = train.id;
  }
  const trainScheduleId = extractEditoastIdFromPacedTrainId(pacedTrainId);
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
        trainScheduleId ===
          extractEditoastIdFromPacedTrainId(
            extractPacedTrainIdFromOccurrenceId(hoveredTrainIdFromChart)
          ))
    ) {
      return {
        color: colors.hovered,
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
          color: colors.hovered,
          level: 1,
          ...(train.isSimulated === false && { border: invalidBorder }),
        };
      }
    } else if (trainScheduleId === extractEditoastIdFromPacedTrainId(hoveredTrainIdFromTimetable)) {
      return {
        color: colors.hovered,
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
          color: colors.normal,
          level: 1,
          border:
            train.isSimulated === false
              ? {
                  offset: 3,
                  width: 13,
                  color: 'rgba(0, 0, 0, 0.05)',
                  backgroundColor: colors.background,
                }
              : {
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
          border:
            train.isSimulated === false
              ? invalidBorder
              : {
                  offset: 3.5,
                  color: 'transparent',
                  backgroundColor: colors.background,
                },
        };
      }
    } else if (train.id === selectedTrainId) {
      return {
        color: colors.normal,
        level: 1,
        ...(train.isSimulated === false && { border: invalidBorder }),
      };
    }
  }

  return {
    color: colors.normal,
    ...(train.isSimulated === false && { border: invalidBorder }),
  };
};

export default getPathStyle;
