import type { TrainMainCategories, SubCategory } from 'common/api/osrdEditoastApi';

export type ValidityFilter = 'both' | 'valid' | 'invalid';

export type ScheduledPointsHonoredFilter = 'both' | 'honored' | 'notHonored';

export type TrainTypeFilter = 'both' | 'pacedTrain' | 'trainSchedule';

export type TrainCategoryFilter =
  | 'all'
  | 'noCategory'
  | (TrainMainCategories | SubCategory['code']);

export type TimetableFilters = {
  uniqueTags: string[];
  nameLabelFilter: string;
  setNameLabelFilter: (nameLabelFilter: string) => void;
  rollingStockFilter: string;
  setRollingStockFilter: (rollingStockFilter: string) => void;
  validityFilter: ValidityFilter;
  setValidityFilter: (validityFilter: ValidityFilter) => void;
  scheduledPointsHonoredFilter: ScheduledPointsHonoredFilter;
  setScheduledPointsHonoredFilter: (
    scheduledPointsHonoredFilter: ScheduledPointsHonoredFilter
  ) => void;
  trainTypeFilter: TrainTypeFilter;
  setTrainTypeFilter: (trainType: TrainTypeFilter) => void;
  selectedTags: Set<string | null>;
  setSelectedTags: React.Dispatch<React.SetStateAction<Set<string | null>>>;
  trainCategoryFilter: TrainCategoryFilter;
  setTrainCategoryFilter: (categoryOption: TrainCategoryFilter) => void;
};
