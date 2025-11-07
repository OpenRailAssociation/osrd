import {
  DEFAULT_TRAIN_PATH_COLORS,
  TRAIN_MAIN_CATEGORY_PATH_COLORS,
} from 'applications/operationalStudies/consts';
import type { SubCategory } from 'common/api/osrdEditoastApi';
import isMainCategory from 'modules/rollingStock/helpers/category';
import type { IndividualTrainProjection } from 'modules/simulationResult/types';
import {
  findExceptionWithOccurrenceId,
  isPacedTrainWithDetails,
} from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type { TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import { isOccurrenceId, extractPacedTrainIdFromOccurrenceId } from 'utils/trainId';

const getTrainCategory = (
  timetableItemsWithDetailsById: Map<TimetableItemId, TimetableItemWithDetails>,
  trainId: TrainId
) => {
  const timetableItemId = isOccurrenceId(trainId)
    ? extractPacedTrainIdFromOccurrenceId(trainId)
    : trainId;

  const item = timetableItemsWithDetailsById.get(timetableItemId);

  if (!item || !isPacedTrainWithDetails(item) || !isOccurrenceId(trainId)) return item?.category;

  const exception = findExceptionWithOccurrenceId(item.paced.exceptions, trainId);
  return exception?.rolling_stock_category?.value ?? item.category;
};

const formatSpaceTimeCurves = (
  subCategories: SubCategory[],
  individualTrainProjections: IndividualTrainProjection[],
  timetableItemsWithDetailsById: Map<TimetableItemId, TimetableItemWithDetails>
) =>
  individualTrainProjections.flatMap((train) => {
    const category = getTrainCategory(timetableItemsWithDetailsById, train.id);

    let colors = DEFAULT_TRAIN_PATH_COLORS;
    if (category) {
      if (isMainCategory(category)) {
        colors = TRAIN_MAIN_CATEGORY_PATH_COLORS[category.main_category];
      } else {
        const currentSubCategory = subCategories.find(
          (option) => option.code === category.sub_category_code
        );
        if (currentSubCategory) {
          colors = {
            normal: currentSubCategory.color,
            hovered: currentSubCategory.hovered_color,
            background: currentSubCategory.background_color,
          };
        }
      }
    }

    const departureTime = train.departureTime.getTime();

    return train.spaceTimeCurves.map((curve) => ({
      id: train.id,
      label: train.name,
      color: colors.normal,
      points: curve.positions.map((position, i) => ({
        time: curve.times[i] + departureTime,
        position,
      })),
    }));
  });

export default formatSpaceTimeCurves;
