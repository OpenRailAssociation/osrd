import type { TFunction } from 'i18next';

import type {
  LabelGroupDto,
  TimeLockDto,
  TrainrunCategory,
  TrainrunFrequency,
  TrainrunTimeCategory,
} from '../NGE/types';

export const TRAINRUN_CATEGORY_HALTEZEITEN = {
  HaltezeitIPV: { haltezeit: 0, no_halt: false },
  HaltezeitA: { haltezeit: 0, no_halt: false },
  HaltezeitB: { haltezeit: 0, no_halt: false },
  HaltezeitC: { haltezeit: 0, no_halt: false },
  HaltezeitD: { haltezeit: 0, no_halt: false },
  HaltezeitUncategorized: { haltezeit: 0, no_halt: false },
};

export const TRAINRUN_LABEL_GROUP: LabelGroupDto = {
  id: 1,
  name: 'Default',
  labelRef: 'Trainrun',
};
export const NODE_LABEL_GROUP: LabelGroupDto = {
  id: 2,
  name: 'Node',
  labelRef: 'Node',
};

export const DEFAULT_TRAINRUN_CATEGORY: TrainrunCategory = {
  id: 1, // In NGE, Trainrun.DEFAULT_TRAINRUN_CATEGORY
  order: 0,
  name: 'Default',
  shortName: '', // TODO: find a better way to hide this in the graph
  fachCategory: 'HaltezeitUncategorized',
  colorRef: 'EC',
  minimalTurnaroundTime: 0,
  nodeHeadwayStop: 0,
  nodeHeadwayNonStop: 0,
  sectionHeadway: 0,
};

/**
 * Return the default TrainrunFrequencies with their translations.
 */
export const getDefaultTrainrunFrequencies = (t: TFunction): TrainrunFrequency[] => [
  {
    id: 1,
    order: 1,
    frequency: 1440,
    offset: 0,
    name: t('uniqueTrainSchedule'),
    shortName: '-',
    linePatternRef: '120',
  },
  {
    id: 2,
    order: 2,
    frequency: 30,
    offset: 0,
    name: t('stepXmin', { minutes: 30 }),
    shortName: '30',
    linePatternRef: '30',
  },
  {
    id: 3,
    order: 3,
    frequency: 60,
    offset: 0,
    name: t('stepXmin', { minutes: 60 }),
    shortName: '60',
    linePatternRef: '60',
  },
  {
    id: 4,
    order: 4,
    frequency: 120,
    offset: 0,
    name: t('stepXmin', { minutes: 120 }),
    shortName: '120',
    linePatternRef: '120',
  },
];

export const UNIQUE_TRAINRUN_FREQUENCY_ID = 1;

export const DEFAULT_PACED_TRAINRUN_FREQUENCY_IDS = [2, 3, 4];

export const DEFAULT_TRAINRUN_TIME_CATEGORIES: TrainrunTimeCategory[] = [
  {
    id: 0,
    order: 0,
    shortName: '____',
    name: 'Plain',
    dayTimeInterval: [],
    weekday: [],
    linePatternRef: '7/24',
  },
  {
    id: 1,
    order: 1,
    shortName: '__.__',
    name: 'Dash (long)',
    dayTimeInterval: [],
    weekday: [],
    linePatternRef: 'HVZ',
  },
  {
    id: 2,
    order: 2,
    shortName: '_._._',
    name: 'Dash (short)',
    dayTimeInterval: [],
    weekday: [],
    linePatternRef: 'ZEITWEISE',
  },
];

export const DEFAULT_TRAINRUN_TIME_CATEGORY = DEFAULT_TRAINRUN_TIME_CATEGORIES[0];

export const CUSTOM_TRAINRUN_TIME_CATEGORY = DEFAULT_TRAINRUN_TIME_CATEGORIES[1];

export const UNIQUE_TRAIN_SCHEDULE_TIME_CATEGORY = DEFAULT_TRAINRUN_TIME_CATEGORIES[2];

export const DEFAULT_TIME_LOCK: TimeLockDto = {
  time: null,
  consecutiveTime: null,
  lock: false,
  warning: null,
  timeFormatter: null,
};
