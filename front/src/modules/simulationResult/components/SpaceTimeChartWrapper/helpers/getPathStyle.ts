import type { PathLevel, HoveredItem, LabelStyle } from '@osrd-project/ui-charts';

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
  opacity?: number;
  level?: PathLevel;
  border?: {
    offset: number;
    color: string;
    width?: number;
    backgroundColor?: string;
  };
  label?: LabelStyle;
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

  const hoveredLabelStyle: LabelStyle = {
    fontWeight: 400,
    backgroundColor: colors.background,
  };
  const selectedLabelStyle: LabelStyle = {
    fontWeight: 600,
    backgroundColor: colors.background,
    textColor: colors.hovered,
  };

  const invalidBorder = {
    offset: 16,
    color: 'transparent',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  };

  const hoveredStyle = {
    color: colors.hovered,
    level: 1 as PathLevel,
    ...(train.isSimulated === false && { border: invalidBorder }),
    label: hoveredLabelStyle,
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
      return hoveredStyle;
    }
  }

  // Check hover from timetable
  if (hoveredTrainIdFromTimetable && !dragging) {
    // When hovering from the timetable list:
    // - if we hover an occurrence, we only highlight that exact occurrence curve
    // - if we hover a paced train (collapsed or expanded header), we highlight all its occurrences
    if (isOccurrenceId(hoveredTrainIdFromTimetable)) {
      if (train.id === hoveredTrainIdFromTimetable) {
        return hoveredStyle;
      }
    } else if (trainScheduleId === extractEditoastIdFromPacedTrainId(hoveredTrainIdFromTimetable)) {
      return hoveredStyle;
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
          label: selectedLabelStyle,
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
        label: selectedLabelStyle,
      };
    }
  }

  return {
    color: colors.normal,
    ...(train.isSimulated === false && { border: invalidBorder }),
    ...(selectedTrainId && { opacity: 0.3 }),
  };
};

export default getPathStyle;
