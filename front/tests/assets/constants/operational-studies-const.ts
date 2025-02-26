import type { PacedTrainBase } from 'common/api/osrdEditoastApi';

export const DEFAULT_PACED_TRAIN_SETTINGS: Pick<PacedTrainBase, 'paced'> = {
  paced: {
    duration: 'PT2H',
    step: 'PT1H',
  },
};

export const PACED_TRAIN_SETTINGS_TEST: Pick<PacedTrainBase, 'paced'> = {
  paced: {
    duration: 'PT3H',
    step: 'PT30M',
  },
};

export const NEW_PACED_TRAIN_SETTINGS: Pick<
  PacedTrainBase,
  'train_name' | 'start_time' | 'labels' | 'paced'
> = {
  train_name: 'Paced train test',
  start_time: '2025-03-15T08:35:40',
  labels: ['Valid'],
  paced: {
    duration: 'PT90M',
    step: 'PT20M',
  },
};
