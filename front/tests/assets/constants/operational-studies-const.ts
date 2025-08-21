import type { OccurrenceDetails, PacedTrainDetails } from '../../utils/types';

export const DEFAULT_PACED_TRAIN_SETTINGS: Pick<PacedTrainDetails, 'timeWindow' | 'interval'> = {
  timeWindow: '120',
  interval: '60',
};

export const PACED_TRAIN_SETTINGS_TEST: Pick<PacedTrainDetails, 'timeWindow' | 'interval'> = {
  timeWindow: '180',
  interval: '30',
};

export const NEW_PACED_TRAIN_SETTINGS: PacedTrainDetails = {
  name: 'Paced train test',
  startTime: '2025-03-15T08:35:40',
  labels: ['Valid'],
  timeWindow: '90',
  interval: '30',
  expectedOccurrencesCount: 3,
};

export const ADD_PACED_TRAIN_OCCURRENCES_DETAILS: OccurrenceDetails[][] = [
  [
    {
      name: 'Paced train test 1',
      startTime: '08:36',
      arrivalTime: '12:16',
    },
    {
      name: 'Paced train test 3',
      startTime: '09:06',
      arrivalTime: '12:46',
    },
    {
      name: 'Paced train test 5',
      startTime: '09:36',
      arrivalTime: '13:16',
    },
  ],
];

export const IMPORTED_PACED_TRAIN_DETAILS: PacedTrainDetails[] = [
  {
    name: '8608',
    startTime: '05:00',
    labels: ['Paced-Train-Tag-1', 'SS-NS', 'Valid'],
    timeWindow: '120',
    interval: '60',
    expectedOccurrencesCount: 2,
  },
  {
    name: 'Paced Train - Updated exception (Train name)',
    startTime: '06:00',
    labels: ['Paced-Train-Tag-2', 'SS-NS', 'Valid'],
    timeWindow: '120',
    interval: '30',
    expectedOccurrencesCount: 4,
  },
  {
    name: 'Paced Train - Updated exception (RS)',
    startTime: '07:00',
    labels: ['Paced-Train-Tag-2', 'MWS-NES', 'Not-honored'],
    timeWindow: '120',
    interval: '50',
    expectedOccurrencesCount: 3,
  },
  {
    name: 'Paced Train - Updated exception (Speed limit tag)',
    startTime: '11:45',
    labels: ['Invalid'],
    timeWindow: '120',
    interval: '60',
    expectedOccurrencesCount: 3,
  },
  {
    name: 'Paced Train - Added exception',
    startTime: '02:00',
    labels: ['Valid'],
    timeWindow: '120',
    interval: '60',
    expectedOccurrencesCount: 3,
  },
  {
    name: 'Paced Train - Updated and added exception (RS)',
    startTime: '11:00',
    labels: ['Paced-Train-Tag-5', 'SS-NS', 'Valid'],
    timeWindow: '180',
    interval: '60',
    expectedOccurrencesCount: 4,
  },
  {
    name: 'Paced Train - All exceptions',
    startTime: '02:48',
    labels: ['NWS-NES', 'Valid'],
    timeWindow: '250',
    interval: '65',
    expectedOccurrencesCount: 5,
  },
];

export const IMPORT_PACED_TRAIN_OCCURRENCES_DETAILS: OccurrenceDetails[][] = [
  [
    {
      name: '8608',
      startTime: '05:00',
      arrivalTime: '05:07',
    },
    {
      name: '8610',
      startTime: '06:00',
      arrivalTime: '06:07',
    },
  ],
  [
    {
      name: 'Paced Train - Updated exception (Train name) 1',
      startTime: '06:00',
      arrivalTime: '06:07',
    },
    {
      name: 'abc',
      startTime: '06:30',
      arrivalTime: '06:37',
    },
    {
      name: 'Paced Train - Updated exception (Train name) 5',
      startTime: '07:00',
      arrivalTime: '07:07',
    },
    {
      name: 'Paced Train - Updated exception (Train name) 7',
      startTime: '07:30',
      arrivalTime: '07:37',
    },
  ],
  [
    {
      name: 'Paced Train - Updated exception (RS) 1',
      startTime: '07:00',
      arrivalTime: '07:19',
    },
    {
      name: 'Paced Train - Updated exception (RS) 3',
      startTime: '07:50',
      arrivalTime: '08:09',
    },
    {
      name: 'Paced Train - Updated exception (RS) 5',
      startTime: '08:40',
      arrivalTime: '09:16',
    },
  ],
  [
    {
      name: 'Paced Train - Updated exception (Speed limit tag) 1',
      startTime: '11:40',
      arrivalTime: '11:46',
    },
    {
      name: 'Paced Train - Updated exception (Speed limit tag) 3',
      startTime: '12:45',
      arrivalTime: '12:51',
    },
  ],
  [
    {
      name: 'Paced Train - Added exception 1',
      startTime: '02:00',
      arrivalTime: '02:07',
    },
    {
      name: 'Paced Train - Added exception/+',
      startTime: '02:30',
      arrivalTime: '02:37',
    },
    {
      name: 'Paced Train - Added exception 3',
      startTime: '03:00',
      arrivalTime: '03:07',
    },
  ],
];

// This duplicated paced train has a startTime/arrivalTime increased by 5min
export const DUPLICATED_PACED_TRAIN_DETAILS: PacedTrainDetails = {
  name: '8608',
  startTime: '05:05',
  labels: ['Paced-Train-Tag-1', 'SS-NS', 'Valid'],
  timeWindow: '120',
  interval: '60',
  expectedOccurrencesCount: 2,
};

// These duplicated occurrences have a startTime/arrivalTime increased by 5min and the name doesn't evolve
// because it will get a "copy" suffix
export const DUPLICATED_PACED_TRAIN_OCCURRENCES_DETAILS: OccurrenceDetails[] = [
  {
    name: '8608',
    startTime: '05:05',
    arrivalTime: '05:12',
  },
  {
    name: '8608',
    startTime: '06:05',
    arrivalTime: '06:12',
  },
];
