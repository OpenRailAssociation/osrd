import {
  type PacedTrain,
  type TrainMainCategory,
  type TrainSchedule,
} from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

import type {
  LabelGroupDto,
  TimeLockDto,
  TrainrunCategory,
  TrainrunFrequency,
  TrainrunTimeCategory,
} from '../NGE/types';

export enum TRAINRUN_DIRECTIONS {
  FORWARD = 'forward',
  BACKWARD = 'backward',
}

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

export const NOTE_LABEL_GROUP: LabelGroupDto = {
  id: 3,
  name: 'Note',
  labelRef: 'Note',
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
 * Return the default TrainrunFrequencies without their translated names.
 * The main types of TimetableItems are to be displayed:
 * - `TrainSchedule` -> `TrainrunFrequency.linePatternRef = '120'`
 * - `PacedTrain`:
 *    - `paced.interval = 30` -> `TrainrunFrequency.linePatternRef = '30'`
 *    - `paced.interval = 60` -> `TrainrunFrequency.linePatternRef = '60'`
 *    - `paced.interval = 120` -> `TrainrunFrequency.linePatternRef = '120'`
 *    - `paced.interval = anything else` -> `TrainrunFrequency.linePatternRef = '60'`
 */
export const DEFAULT_TRAINRUN_FREQUENCIES: Omit<TrainrunFrequency, 'name'>[] = [
  {
    id: 1,
    order: 1,
    frequency: 1440,
    offset: 0,
    shortName: '-',
    linePatternRef: '120',
  },
  {
    id: 2,
    order: 2,
    frequency: 30,
    offset: 0,
    shortName: '30',
    linePatternRef: '30',
  },
  {
    id: 3,
    order: 3,
    frequency: 60,
    offset: 0,
    shortName: '60',
    linePatternRef: '60',
  },
  {
    id: 4,
    order: 4,
    frequency: 120,
    offset: 0,
    shortName: '120',
    linePatternRef: '120',
  },
];

export const TRAIN_SCHEDULE_FREQUENCY_ID = 1;

/**
 * Default TrainrunFrequencies ids that are not TrainSchedule.
 */
export const DEFAULT_PACED_TRAIN_FREQUENCY_IDS = DEFAULT_TRAINRUN_FREQUENCIES.filter(
  (freq) => freq.id !== TRAIN_SCHEDULE_FREQUENCY_ID
).map((freq) => freq.id);

/**
 * For cosmetic use only, attributes except id and linePatternRef are not used.
 * The main types of TimetableItems are to be displayed:
 * - `TrainSchedule` -> `TrainrunTimeCategory.linePatternRef = 'ZEITWEISE'`
 * - `PacedTrain`:
 *    - `paced.interval = 30` -> `TrainrunTimeCategory.linePatternRef = '7/24'`
 *    - `paced.interval = 60` -> `TrainrunTimeCategory.linePatternRef = '7/24'`
 *    - `paced.interval = 120` -> `TrainrunTimeCategory.linePatternRef = '7/24'`
 *    - `paced.interval = anything else` -> `TrainrunTimeCategory.linePatternRef = 'HVZ'`
 */
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

export const DEFAULT_TRAIN_SCHEDULE_PAYLOAD: Pick<
  TrainSchedule,
  'constraint_distribution' | 'rolling_stock_name'
> = {
  constraint_distribution: 'STANDARD',
  rolling_stock_name: '',
};

export const DEFAULT_PACED_TRAIN_PAYLOAD: Pick<
  PacedTrain,
  'constraint_distribution' | 'rolling_stock_name' | 'exceptions'
> = {
  ...DEFAULT_TRAIN_SCHEDULE_PAYLOAD,
  exceptions: [],
};

export const DEFAULT_TIME_WINDOW = new Duration({ hours: 2 });

export const TRAIN_MAIN_CATEGORY_TO_NGE: {
  trainCategory: TrainMainCategory | 'NO_CATEGORY';
  colorRef: string;
}[] = [
  { trainCategory: 'HIGH_SPEED_TRAIN', colorRef: 'HST' },
  { trainCategory: 'INTERCITY_TRAIN', colorRef: 'IC' },
  { trainCategory: 'REGIONAL_TRAIN', colorRef: 'RE' },
  { trainCategory: 'COMMUTER_TRAIN', colorRef: 'S' },
  { trainCategory: 'FREIGHT_TRAIN', colorRef: 'F' },
  { trainCategory: 'FAST_FREIGHT_TRAIN', colorRef: 'FF' },
  { trainCategory: 'TRAM_TRAIN', colorRef: 'TT' },
  { trainCategory: 'WORK_TRAIN', colorRef: 'W' },
  { trainCategory: 'NIGHT_TRAIN', colorRef: 'NT' },
  { trainCategory: 'TOURISTIC_TRAIN', colorRef: 'TO' },
  { trainCategory: 'NO_CATEGORY', colorRef: 'NC' },
];

export const OSRD_TRAINRUN_MAIN_CATEGORY_CODE_MAPPING = new Map<
  TrainMainCategory | 'NO_CATEGORY',
  TrainrunCategory
>();

TRAIN_MAIN_CATEGORY_TO_NGE.forEach(({ trainCategory, colorRef }, index) => {
  OSRD_TRAINRUN_MAIN_CATEGORY_CODE_MAPPING.set(trainCategory, {
    id: index + 1,
    order: index + 1,
    name: trainCategory,
    shortName: '',
    fachCategory: 'HaltezeitUncategorized',
    colorRef,
    minimalTurnaroundTime: 0,
    nodeHeadwayStop: 0,
    nodeHeadwayNonStop: 0,
    sectionHeadway: 0,
  });
});

export const NETZGRAFIK_COLOR_PALETTE = {
  HST: 'red',
  IC: 'parma',
  RE: 'orange',
  S: 'cyan',
  F: 'green',
  FF: 'mint',
  TT: 'sage',
  W: 'yellow',
  NT: 'purple',
  TO: 'brown',
  NC: 'grey',
} as const;

export const CATEGORY_COLOR_VARIANTS = {
  red10: '#fae7e6',
  red50: '#e5221a',
  red70: '#912420',
  parma10: '#fae6f6',
  parma50: '#b2539e',
  parma70: '#732963',
  purple10: '#E5E7FF',
  purple50: '#8757E6',
  purple70: '#58318F',
  orange10: '#ffe7d6',
  orange50: '#c75300',
  orange70: '#803500',
  blue10: '#E0EDFF',
  blue50: '#3470E0',
  blue70: '#244C91',
  cyan10: '#D9F2FF',
  cyan50: '#127DB8',
  cyan70: '#165070',
  green10: '#e4eddf',
  green50: '#54823b',
  green70: '#2c4f19',
  mint10: '#daf7ee',
  mint50: '#13857b',
  mint70: '#085953',
  sage10: '#E1EDD8',
  sage50: '#687C5C',
  sage70: '#444D3C',
  black10: '#E7ECF2',
  black50: '#6C767F',
  black70: '#3F464B',
  yellow10: '#FCEEC2',
  yellow50: '#996e00',
  yellow70: '#634A00',
  pink10: '#ffe8f2',
  pink50: '#e02271',
  // The initial mockup color was #870048, but since it looked too close to the standard red on display, we switched to #9a2053.
  pink70: '#9a2053',
  brown10: '#eee7d9',
  brown50: '#8a714b',
  brown70: '#594525',
  grey10: '#ebebea',
  grey50: '#797671',
  grey70: '#494641',
} as const;
