import type { OccurrenceDetails, PacedTrainDetails } from '../../utils/types';

export const DEFAULT_PACED_TRAIN_SETTINGS: Pick<PacedTrainDetails, 'duration' | 'step'> = {
  duration: '120',
  step: '60',
};

export const PACED_TRAIN_SETTINGS_TEST: Pick<PacedTrainDetails, 'duration' | 'step'> = {
  duration: '180',
  step: '30',
};

export const NEW_PACED_TRAIN_SETTINGS: PacedTrainDetails = {
  name: 'Paced train test',
  startTime: '2025-03-15T08:35:40',
  labels: ['Valid'],
  duration: '90',
  step: '30',
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

export const IMPORTED_PACED_TRAIN_DETAILS: PacedTrainDetails[] = [
  {
    name: '8608',
    startTime: '05:00',
    labels: ['Paced-Train-Tag-1', 'SS-NS', 'Valid'],
    duration: '120',
    step: '60',
  },
  {
    name: 'Paced Train 2',
    startTime: '06:00',
    labels: ['Paced-Train-Tag-2', 'SS-NS', 'Valid'],
    duration: '120',
    step: '30',
  },
  {
    name: 'PacedTrain3',
    startTime: '07:00',
    labels: ['Paced-Train-Tag-2', 'MWS-NES', 'Not-honored'],
    duration: '120',
    step: '50',
  },
  {
    name: 'PacedTrain4',
    startTime: '11:45',
    labels: ['Invalid'],
    duration: '120',
    step: '60',
  },
];

export const IMPORT_PACED_TRAIN_OCCURRENCES_DETAILS: OccurrenceDetails[][] = [
  [
    {
      name: '8608',
      startTime: '05:00',
      arrivalTime: '05:06',
    },
    {
      name: '8610',
      startTime: '06:00',
      arrivalTime: '06:06',
    },
  ],
  [
    {
      name: 'Paced Train 2',
      startTime: '06:00',
      arrivalTime: '06:06',
    },
    {
      name: 'Paced Train 4',
      startTime: '06:30',
      arrivalTime: '06:36',
    },
    {
      name: 'Paced Train 6',
      startTime: '07:00',
      arrivalTime: '07:06',
    },
    {
      name: 'Paced Train 8',
      startTime: '07:30',
      arrivalTime: '07:36',
    },
  ],
  [
    {
      name: 'PacedTrain3 1',
      startTime: '07:00',
      arrivalTime: '07:19',
    },
    {
      name: 'PacedTrain3 3',
      startTime: '07:50',
      arrivalTime: '08:09',
    },
    {
      name: 'PacedTrain3 5',
      startTime: '08:40',
      arrivalTime: '08:59',
    },
  ],
  [
    {
      name: 'PacedTrain4 1',
      startTime: '11:40',
      arrivalTime: '11:46',
    },
    {
      name: 'PacedTrain4 3',
      startTime: '12:45',
      arrivalTime: '12:51',
    },
  ],
];

// This duplicated paced train has a startTime/arrivalTime increased by 5min
export const DUPLICATED_PACED_TRAIN_DETAILS: PacedTrainDetails = {
  name: '8608',
  startTime: '05:05',
  labels: ['Paced-Train-Tag-1', 'SS-NS', 'Valid'],
  duration: '120',
  step: '60',
};

// These duplicated occurrences have a startTime/arrivalTime increased by 5min and the name doesn't evolve
// because it will get a "copy" suffix
export const DUPLICATED_PACED_TRAIN_OCCURRENCES_DETAILS: OccurrenceDetails[] = [
  {
    name: '8608',
    startTime: '05:05',
    arrivalTime: '05:11',
  },
  {
    name: '8608',
    startTime: '06:05',
    arrivalTime: '06:11',
  },
];
