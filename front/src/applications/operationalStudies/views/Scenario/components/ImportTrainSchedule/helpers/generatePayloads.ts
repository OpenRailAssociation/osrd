import type { PacedTrainFromJson } from 'applications/operationalStudies/types';
import type {
  TrainSchedule,
  SubCategory,
  TrainCategory,
  TrainMainCategory,
  PacedTrainException,
} from 'common/api/osrdEditoastApi';
import { TrainMainCategoryDict } from 'modules/rollingStock/consts';
import isMainCategory from 'modules/rollingStock/helpers/category';

export const generateRoundTripsPayload = (
  roundTripsIndexes: ([number, number] | [number, null])[],
  trainIds: { id: number }[]
) => {
  const trainScheduleOneWays: number[] = [];
  const trainScheduleRoundTrips: [number, number][] = [];

  for (const [firstIndex, secondIndex] of roundTripsIndexes) {
    if (secondIndex === null) {
      trainScheduleOneWays.push(trainIds[firstIndex].id);
    } else {
      trainScheduleRoundTrips.push([trainIds[firstIndex].id, trainIds[secondIndex].id]);
    }
  }
  return {
    roundTrips: {
      one_ways: trainScheduleOneWays,
      round_trips: trainScheduleRoundTrips,
    },
  };
};

const isTrainMainCategory = (v: string): v is TrainMainCategory => v in TrainMainCategoryDict;

const checkCategory = (
  category: TrainCategory | string | null | undefined,
  allowedSubCategories: SubCategory[]
): TrainCategory | null => {
  if (!category) return null;

  // This condition is added for train imports that still use the old format: `category: string`, in particular imports from nge
  if (typeof category === 'string') {
    if (isTrainMainCategory(category)) return { main_category: category };
    let correspondingSubCategory = allowedSubCategories.find(
      (subCategory) => subCategory.code === category
    );
    if (!correspondingSubCategory)
      correspondingSubCategory = allowedSubCategories.find(
        (subCategory) => subCategory.name === category
      );
    return correspondingSubCategory ? { sub_category_code: correspondingSubCategory.code } : null;
  }

  if (isMainCategory(category)) {
    return isTrainMainCategory(category.main_category) ? category : null;
  }

  const hasValidSubCategory = allowedSubCategories.some(
    (subCategory) => subCategory.code === category.sub_category_code
  );
  return hasValidSubCategory ? category : null;
};

const unrecognizedCategoryToLabel = (
  category: TrainCategory | string | null | undefined,
  allowedSubCategories: SubCategory[]
): string | null => {
  if (!category || checkCategory(category, allowedSubCategories)) return null;
  if (typeof category === 'string') {
    return category;
  }
  if (isMainCategory(category)) {
    return category.main_category;
  }
  return category.sub_category_code;
};

const buildLabels = (
  labels: string[] | undefined,
  category: TrainCategory | string | null | undefined,
  allowedSubCategories: SubCategory[]
): string[] | undefined => {
  const unrecognizedCategoryLabel = unrecognizedCategoryToLabel(category, allowedSubCategories);
  if (!unrecognizedCategoryLabel) return labels;
  if (!labels) return [unrecognizedCategoryLabel];
  if (labels.includes(unrecognizedCategoryLabel)) return labels;
  return [...labels, unrecognizedCategoryLabel];
};

export function generateTrainPayloads(
  parsedPacedTrains: PacedTrainFromJson[],
  allowedSubCategories: SubCategory[]
): { trainSchedules: TrainSchedule[]; exceptions: PacedTrainException[][] } {
  const trainSchedules: TrainSchedule[] = [];
  const exceptions: PacedTrainException[][] = [];

  for (const pacedTrain of parsedPacedTrains) {
    const { paced, ...trainScheduleBase } = pacedTrain;

    const { exceptions: pacedExceptions } = paced ?? { exceptions: [] };

    trainSchedules.push({
      ...trainScheduleBase,
      start_time:
        typeof pacedTrain.start_time === 'string'
          ? new Date(pacedTrain.start_time).getTime()
          : pacedTrain.start_time,
      category: checkCategory(pacedTrain.category, allowedSubCategories),
      labels: buildLabels(pacedTrain.labels, pacedTrain.category, allowedSubCategories),
      paced: paced
        ? { interval: paced.interval, time_window: paced.time_window, exceptions: [] }
        : undefined,
    });

    exceptions.push(pacedExceptions);
  }

  return { trainSchedules, exceptions };
}
