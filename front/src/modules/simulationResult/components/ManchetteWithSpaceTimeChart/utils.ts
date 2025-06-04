/* eslint-disable import/prefer-default-export */
import type { PathLevel, HoveredItem } from '@osrd-project/ui-charts';

import {
  DEFAULT_TRAIN_PATH_COLORS,
  TRAIN_CATEGORY_PATH_COLORS,
} from 'modules/simulationResult/consts';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';
import type { TrainId } from 'reducers/osrdconf/types';
import { extractPacedTrainIdFromOccurrenceId, isOccurrenceId } from 'utils/trainId';

const getPathStyle = (
  hovered: HoveredItem | null,
  train: { color: string; id: string },
  dragging: boolean,
  timetableItemsWithDetails?: TimetableItemWithDetails[],
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
  const trainId = isOccurrenceId(train.id)
    ? extractPacedTrainIdFromOccurrenceId(train.id)
    : train.id;
  const item = timetableItemsWithDetails?.find((t) => t.id === trainId);
  const category = item?.category;

  const colors = category ? TRAIN_CATEGORY_PATH_COLORS[category] : DEFAULT_TRAIN_PATH_COLORS;

  if (hovered && 'pathId' in hovered.element && train.id === hovered.element.pathId && !dragging) {
    return { color: colors.hovered, level: 1 };
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
