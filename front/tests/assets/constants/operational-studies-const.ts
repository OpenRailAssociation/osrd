import { formatDayJSDateToHHMM } from '../../utils/date-utils';
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
      startTime: formatDayJSDateToHHMM('2025-03-15T08:35:40', 'Europe/Paris'),
      arrivalTime: formatDayJSDateToHHMM('2025-03-15T12:16:00', 'Europe/Paris'),
    },
    {
      name: 'Paced train test 3',
      startTime: formatDayJSDateToHHMM('2025-03-15T09:05:40', 'Europe/Paris'),
      arrivalTime: formatDayJSDateToHHMM('2025-03-15T12:46:00', 'Europe/Paris'),
    },
    {
      name: 'Paced train test 5',
      startTime: formatDayJSDateToHHMM('2025-03-15T09:35:40', 'Europe/Paris'),
      arrivalTime: formatDayJSDateToHHMM('2025-03-15T13:16:00', 'Europe/Paris'),
    },
  ],
];

export const IMPORTED_PACED_TRAIN_DETAILS: PacedTrainDetails[] = [
  {
    name: '8608',
    startTime: formatDayJSDateToHHMM('2024-10-15T03:00:00', 'Europe/Paris'),
    labels: ['Paced-Train-Tag-1', 'SS-NS', 'Valid'],
    duration: '120',
    step: '60',
  },
  {
    name: 'Paced Train 2',
    startTime: formatDayJSDateToHHMM('2024-10-15T04:00:00', 'Europe/Paris'),
    labels: ['Paced-Train-Tag-2', 'SS-NS', 'Valid'],
    duration: '120',
    step: '30',
  },
  {
    name: 'PacedTrain3',
    startTime: formatDayJSDateToHHMM('2024-10-15T05:00:00', 'Europe/Paris'),
    labels: ['Paced-Train-Tag-2', 'MWS-NES', 'Not-honored'],
    duration: '120',
    step: '50',
  },
  {
    name: 'PacedTrain4',
    startTime: formatDayJSDateToHHMM('2024-10-15T09:45:00', 'Europe/Paris'),
    labels: ['Invalid'],
    duration: '120',
    step: '60',
  },
];

export const DUPLICATED_PACED_TRAIN_DETAILS: PacedTrainDetails = {
  name: '8608',
  startTime: formatDayJSDateToHHMM('2024-10-15T03:00:00', 'Europe/Paris'),
  labels: ['Paced-Train-Tag-1', 'SS-NS', 'Valid'],
  duration: '120',
  step: '60',
};

export const IMPORT_PACED_TRAIN_OCCURRENCES_DETAILS: OccurrenceDetails[][] = [
  [
    {
      name: '8608',
      startTime: formatDayJSDateToHHMM('2024-10-15T03:00:00Z', 'Europe/Paris'),
      arrivalTime: formatDayJSDateToHHMM('2024-10-15T03:06:00Z', 'Europe/Paris'),
    },
    {
      name: '8610',
      startTime: formatDayJSDateToHHMM('2024-10-15T04:00:00Z', 'Europe/Paris'),
      arrivalTime: formatDayJSDateToHHMM('2024-10-15T04:06:00Z', 'Europe/Paris'),
    },
  ],
  [
    {
      name: 'Paced Train 2',
      startTime: formatDayJSDateToHHMM('2024-10-15T04:00:00Z', 'Europe/Paris'),
      arrivalTime: '04:00',
    },
    {
      name: 'Paced Train 4',
      startTime: formatDayJSDateToHHMM('2024-10-15T04:30:00Z', 'Europe/Paris'),
      arrivalTime: '04:00',
    },
    {
      name: 'Paced Train 6',
      startTime: formatDayJSDateToHHMM('2024-10-15T05:00:00Z', 'Europe/Paris'),
      arrivalTime: '04:00',
    },
    {
      name: 'Paced Train 8',
      startTime: formatDayJSDateToHHMM('2024-10-15T05:30:00Z', 'Europe/Paris'),
      arrivalTime: '04:00',
    },
  ],
  [
    {
      name: 'PacedTrain3 1',
      startTime: formatDayJSDateToHHMM('2024-10-15T05:00:00', 'Europe/Paris'),
      arrivalTime: '05:00',
    },
    {
      name: 'PacedTrain3 3',
      startTime: formatDayJSDateToHHMM('2024-10-15T05:50:00', 'Europe/Paris'),
      arrivalTime: '05:00',
    },
    {
      name: 'PacedTrain3 5',
      startTime: formatDayJSDateToHHMM('2024-10-15T06:40:00', 'Europe/Paris'),
      arrivalTime: '05:00',
    },
  ],
  [
    {
      name: 'PacedTrain4 1',
      startTime: formatDayJSDateToHHMM('2024-10-15T09:40:00', 'Europe/Paris'),
      arrivalTime: '09:45',
    },
    {
      name: 'PacedTrain4 3',
      startTime: formatDayJSDateToHHMM('2024-10-15T10:45:00', 'Europe/Paris'),
      arrivalTime: '09:45',
    },
  ],
];
