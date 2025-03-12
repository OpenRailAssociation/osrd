import type { PacedTrainBase } from 'common/api/osrdEditoastApi';

import type { OccurrenceDetails } from '../../utils/types';

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
    step: 'PT30M',
  },
};

export const ADD_PACED_TRAIN_OCCURRENCES_DETAILS: OccurrenceDetails[][] = [
  [
    {
      name: 'Paced train test 1',
      startTime: '08:35',
      arrivalTime: '12:16',
    },
    {
      name: 'Paced train test 3',
      startTime: '09:05',
      arrivalTime: '12:46',
    },
    {
      name: 'Paced train test 5',
      startTime: '09:35',
      arrivalTime: '13:16',
    },
  ],
];

export const IMPORT_PACED_TRAIN_OCCURRENCES_DETAILS: OccurrenceDetails[][] = [
  [
    {
      name: '8608',
      startTime: '03:00',
      arrivalTime: '03:00',
    },
    {
      name: '8610',
      startTime: '04:00',
      arrivalTime: '03:00',
    },
  ],
  [
    {
      name: 'Paced Train 2',
      startTime: '04:00',
      arrivalTime: '04:00',
    },
    {
      name: 'Paced Train 4',
      startTime: '04:30',
      arrivalTime: '04:00',
    },
    {
      name: 'Paced Train 6',
      startTime: '05:00',
      arrivalTime: '04:00',
    },
    {
      name: 'Paced Train 8',
      startTime: '05:30',
      arrivalTime: '04:00',
    },
  ],
  [
    {
      name: 'PacedTrain3 1',
      startTime: '05:00',
      arrivalTime: '05:00',
    },
    {
      name: 'PacedTrain3 3',
      startTime: '05:50',
      arrivalTime: '05:00',
    },
    {
      name: 'PacedTrain3 5',
      startTime: '06:40',
      arrivalTime: '05:00',
    },
  ],
  [
    {
      name: 'PacedTrain4 1',
      startTime: '09:45',
      arrivalTime: '09:45',
    },
    {
      name: 'PacedTrain4 3',
      startTime: '10:45',
      arrivalTime: '09:45',
    },
  ],
];
