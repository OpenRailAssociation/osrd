import type { PathData } from '@osrd-project/ui-charts';

import {
  DEFAULT_TRAIN_PATH_COLORS,
  TRAIN_MAIN_CATEGORY_PATH_COLORS,
} from 'applications/operationalStudies/consts';
import type { CategoryColors } from 'applications/operationalStudies/types';
import type { SubCategory } from 'common/api/osrdEditoastApi';
import isMainCategory from 'modules/rollingStock/helpers/category';
import type { IndividualTrainProjection } from 'modules/simulationResult/types';
import {
  findExceptionWithOccurrenceId,
  isPacedTrainWithDetails,
} from 'modules/trainSchedule/helpers/pacedTrain';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { TrainId } from 'reducers/osrdconf/types';
import {
  isOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  extractEditoastIdFromPacedTrainId,
} from 'utils/trainId';

export type PathDataWithSimulated = PathData & {
  colors: CategoryColors;
  isSimulated?: boolean;
  isStartTimeException?: boolean;
};

const getTrainCategory = (
  trainSchedulesWithDetailsById: Map<number, TrainScheduleWithDetails>,
  trainId: TrainId
) => {
  const trainScheduleId = extractEditoastIdFromPacedTrainId(
    isOccurrenceId(trainId) ? extractPacedTrainIdFromOccurrenceId(trainId) : trainId
  );

  const trainSchedule = trainSchedulesWithDetailsById.get(trainScheduleId);

  if (!trainSchedule || !isPacedTrainWithDetails(trainSchedule) || !isOccurrenceId(trainId))
    return trainSchedule?.category;

  const exception = findExceptionWithOccurrenceId(trainSchedule.paced.exceptions, trainId);
  return exception?.rolling_stock_category?.value ?? trainSchedule.category;
};

const formatSpaceTimeCurves = (
  subCategories: SubCategory[],
  individualTrainProjections: IndividualTrainProjection[],
  trainSchedulesWithDetailsById: Map<number, TrainScheduleWithDetails>
): PathDataWithSimulated[] =>
  individualTrainProjections.flatMap((train) => {
    const category = getTrainCategory(trainSchedulesWithDetailsById, train.id);

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

    const isStartTimeException =
      ('exception' in train && !!train.exception?.start_time) || undefined;

    return train.spaceTimeCurves.map((curve) => ({
      id: train.id,
      isSimulated: train.isSimulated,
      isStartTimeException,
      label: train.name,
      colors,
      points: curve.positions.map((position, i) => ({
        time: curve.times[i] + departureTime,
        position,
      })),
    }));
  });

export default formatSpaceTimeCurves;
