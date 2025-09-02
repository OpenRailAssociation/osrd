import type {
  TrainMainCategories,
  SubCategory,
  PacedTrain,
  TrainMainCategory,
} from 'common/api/osrdEditoastApi';
import isMainCategory from 'modules/rollingStock/helpers/category';

const TRAIN_MAIN_CATEGORY_CLASS: Record<TrainMainCategory | 'None', string> = {
  HIGH_SPEED_TRAIN: 'high-speed',
  INTERCITY_TRAIN: 'intercity',
  REGIONAL_TRAIN: 'regional',
  NIGHT_TRAIN: 'night',
  COMMUTER_TRAIN: 'commuter',
  FREIGHT_TRAIN: 'freight',
  FAST_FREIGHT_TRAIN: 'fast-freight',
  TRAM_TRAIN: 'tram-train',
  TOURISTIC_TRAIN: 'touristic',
  WORK_TRAIN: 'work',
  None: 'none',
};

export function extractCategoryId(fullId: string): TrainMainCategories | SubCategory['code'] {
  const [prefix, code] = fullId.split(':');

  if (prefix === 'main' || prefix === 'sub') {
    return code;
  }

  throw new Error(`Unknown category prefix: ${prefix}`);
}

export const getTrainCategoryClassName = (
  trainCategory: PacedTrain['category'],
  type: 'bg' | 'text'
) => {
  if (!trainCategory) return `train-category-${type}-none`;
  if (isMainCategory(trainCategory)) {
    return `train-category-${type}-${TRAIN_MAIN_CATEGORY_CLASS[trainCategory.main_category]}`;
  }
  return null;
};
