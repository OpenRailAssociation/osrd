import type { PathLevel, HoveredItem } from '@osrd-project/ui-charts';

import {
  DEFAULT_TRAIN_PATH_COLORS,
  TRAIN_MAIN_CATEGORY_PATH_COLORS,
} from 'applications/operationalStudies/consts';
import type { SubCategory } from 'common/api/osrdEditoastApi';
import isMainCategory from 'modules/rollingStock/helpers/category';
import { findExceptionWithOccurrenceId } from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type { TrainId } from 'reducers/osrdconf/types';
import {
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
  isPacedTrainWithDetails,
} from 'utils/trainId';

const getPathStyle = (
  hovered: HoveredItem | null,
  train: { color: string; id: string },
  dragging: boolean,
  subCategories: SubCategory[],
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
  const timetableItemId = isOccurrenceId(train.id)
    ? extractPacedTrainIdFromOccurrenceId(train.id)
    : train.id;

  const item = timetableItemsWithDetails?.find((t) => t.id === timetableItemId);

  const exception =
    item && isPacedTrainWithDetails(item) && isOccurrenceId(train.id)
      ? findExceptionWithOccurrenceId(item?.exceptions, train.id)
      : null;

  const category = exception?.rolling_stock_category?.value ?? item?.category;

  const currentSubCategory =
    category && !isMainCategory(category)
      ? subCategories.find((option) => option.code === category.sub_category_code)
      : undefined;

  let colors = DEFAULT_TRAIN_PATH_COLORS;

  if (category && isMainCategory(category)) {
    colors = TRAIN_MAIN_CATEGORY_PATH_COLORS[category.main_category];
  } else if (category && !isMainCategory(category) && currentSubCategory) {
    colors = {
      normal: currentSubCategory.color || DEFAULT_TRAIN_PATH_COLORS.normal,
      hovered: currentSubCategory.hovered_color || DEFAULT_TRAIN_PATH_COLORS.hovered,
      background: currentSubCategory.background_color || DEFAULT_TRAIN_PATH_COLORS.background,
    };
  }

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
