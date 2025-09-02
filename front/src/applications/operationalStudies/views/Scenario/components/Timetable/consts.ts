import type { TrainMainCategory } from 'common/api/osrdEditoastApi';

export const specialCodeDictionary: { [key: string]: string } = {
  '': 'NO CODE',
};

export const TRAIN_MAIN_CATEGORY_CLASS: Record<TrainMainCategory | 'None', string> = {
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

export const TIMETABLE_ITEM_DELTA = 5;
