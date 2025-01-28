import type {
  LabelGroupDto,
  NetzgrafikDto,
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

export const DEFAULT_TRAINRUN_FREQUENCIES: TrainrunFrequency[] = [
  {
    id: 2,
    order: 0,
    frequency: 30,
    offset: 0,
    name: 'Half-hourly',
    shortName: '30',
    linePatternRef: '30',
  },
  {
    id: 3, // default NGE frequency takes id 3
    order: 1,
    frequency: 60,
    offset: 0,
    name: 'Hourly',
    /** Short name, needs to be unique */
    shortName: '60',
    linePatternRef: '60',
  },
  {
    id: 4,
    order: 2,
    frequency: 120,
    offset: 0,
    name: 'Two-hourly',
    shortName: '120',
    linePatternRef: '120',
  },
];

export const DEFAULT_TRAINRUN_FREQUENCY: TrainrunFrequency = DEFAULT_TRAINRUN_FREQUENCIES[1];

export const DEFAULT_TRAINRUN_TIME_CATEGORY: TrainrunTimeCategory = {
  id: 0, // In NGE, Trainrun.DEFAULT_TRAINRUN_TIME_CATEGORY
  order: 0,
  name: 'Default',
  shortName: '7/24',
  dayTimeInterval: [],
  weekday: [1, 2, 3, 4, 5, 6, 7],
  linePatternRef: '7/24',
};

export const DEFAULT_DTO: NetzgrafikDto = {
  resources: [],
  nodes: [],
  trainruns: [],
  trainrunSections: [],
  metadata: {
    netzgrafikColors: [],
    trainrunCategories: [DEFAULT_TRAINRUN_CATEGORY],
    trainrunFrequencies: [...DEFAULT_TRAINRUN_FREQUENCIES],
    trainrunTimeCategories: [DEFAULT_TRAINRUN_TIME_CATEGORY],
  },
  freeFloatingTexts: [],
  labels: [],
  labelGroups: [],
  filterData: {
    filterSettings: [],
  },
};

export const DEFAULT_TIME_LOCK: TimeLockDto = {
  time: null,
  consecutiveTime: null,
  lock: false,
  warning: null,
  timeFormatter: null,
};
