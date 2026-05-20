import type { PathLayerProps, PathLevel, HoveredItem, LabelStyle } from '@osrd-project/ui-charts';

import { STD_SELECTED_TRAIN_COLORS } from 'applications/operationalStudies/consts';
import type { CategoryColors } from 'applications/operationalStudies/types';
import type { PacedTrainId, TrainId } from 'reducers/osrdconf/types';
import type { SelectedTrain } from 'reducers/simulationResults/types';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
  isPacedTrainId,
} from 'utils/trainId';

const getPathStyle = (
  hovered: HoveredItem | null,
  train: {
    colors: CategoryColors;
    id: string;
    isSimulated?: boolean;
    isStartTimeException?: boolean;
  },
  dragging: boolean,
  selectedTrain?: SelectedTrain,
  hoveredTrainIdFromTimetable?: TrainId
): Pick<PathLayerProps, 'color' | 'opacity' | 'level' | 'border' | 'label'> => {
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

  const selectedId = selectedTrain?.id;
  const isInSelectedGroup =
    !!selectedId &&
    (isOccurrenceId(selectedId)
      ? !train.isStartTimeException &&
        isOccurrenceId(train.id) &&
        extractPacedTrainIdFromOccurrenceId(train.id) ===
          extractPacedTrainIdFromOccurrenceId(selectedId)
      : train.id === selectedId);
  const isSameMission =
    !!selectedId &&
    isOccurrenceId(selectedId) &&
    isOccurrenceId(train.id) &&
    extractPacedTrainIdFromOccurrenceId(train.id) ===
      extractPacedTrainIdFromOccurrenceId(selectedId);
  const opacity =
    selectedTrain?.by === 'std' && !isInSelectedGroup && !(train.isStartTimeException && isSameMission)
      ? 0.3
      : 1;
  const selectedColor =
    selectedTrain?.by === 'std' ? STD_SELECTED_TRAIN_COLORS.normal : colors.normal;
  const selectionBorder = {
    offset: 0,
    width: 2,
    color: selectedTrain?.by === 'std' ? STD_SELECTED_TRAIN_COLORS.background : colors.background,
  };

  if (selectedId) {
    if (isOccurrenceId(selectedId)) {
      if (train.id === selectedId) {
        return {
          color: selectedColor,
          level: 1,
          opacity,
          border: train.isSimulated === false ? invalidBorder : selectionBorder,
          label: selectedLabelStyle,
        };
      }
      // Other occurrences from the same paced train (excluding start-time exceptions)
      if (
        !train.isStartTimeException &&
        isOccurrenceId(train.id) &&
        extractPacedTrainIdFromOccurrenceId(train.id) ===
          extractPacedTrainIdFromOccurrenceId(selectedId)
      ) {
        return {
          color: selectedColor,
          level: 1,
          opacity,
          border: train.isSimulated === false ? invalidBorder : selectionBorder,
          label: train.isStartTimeException
            ? {
                backgroundColor: colors.background,
                border: { color: colors.normal },
                textColor: colors.hovered,
              }
            : selectedLabelStyle,
        };
      }
    } else if (train.id === selectedId) {
      return {
        color: selectedColor,
        level: 1,
        opacity,
        border: train.isSimulated === false ? invalidBorder : selectionBorder,
        label: selectedLabelStyle,
      };
    }
  }

  return {
    color: colors.normal,
    opacity,
    ...(train.isSimulated === false
      ? { border: invalidBorder }
      : train.isStartTimeException &&
        isSameMission && { border: { offset: 0, width: 2, color: colors.background } }),
    ...(train.isStartTimeException &&
      isSameMission && {
        label: {
          backgroundColor: colors.background,
          border: { color: colors.normal },
          textColor: colors.hovered,
        },
      }),
  };
};

export default getPathStyle;
