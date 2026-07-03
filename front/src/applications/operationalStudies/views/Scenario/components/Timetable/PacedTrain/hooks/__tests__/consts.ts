import type { LightRollingStockWithLiveries, TrainMainCategory } from 'common/api/osrdEditoastApi';
import type { Occurrence, PacedTrainWithDetails } from 'modules/trainSchedule/types';
import type { OccurrenceId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

const ROLLING_STOCK_NAME = 'fast-rs';
const PACED_INTERVAL = Duration.parse('PT45M');
const PACED_TIME_WINDOW = Duration.parse('PT2H');

export const rollingStock = {
  name: ROLLING_STOCK_NAME,
  effort_curves: { modes: {} },
} as LightRollingStockWithLiveries;

export const pacedTrainSchedule: PacedTrainWithDetails = {
  stopsCount: 5,
  category: { main_category: 'HIGH_SPEED_TRAIN' },
  rollingStock,
  id: 1,
  name: 'Paced Train 1',
  startTime: new Date('2026-06-09T08:00:00Z'),
  rollingStockName: ROLLING_STOCK_NAME,
  paced: {
    timeWindow: PACED_TIME_WINDOW,
    interval: PACED_INTERVAL,
    exceptions: [],
  },
  constraint_distribution: 'STANDARD',
  path: [],
  train_schedule_set_id: 0,
  labels: [],
  speedLimitTag: null,
};

export const pacedTrainWithExceptions: PacedTrainWithDetails = {
  ...pacedTrainSchedule,
  paced: {
    ...pacedTrainSchedule.paced,
    exceptions: [
      {
        key: 'occurrence_1_0',
        id: 42,
        occurrence_index: 0,
        train_name: { value: 'Exception Train 1' },
        start_time: { value: new Date('2026-06-09T08:05:00Z').getTime() },
        disabled: false,
      },
    ],
  },
};

export const pacedTrainWithDisabledOccurrence: PacedTrainWithDetails = {
  ...pacedTrainSchedule,
  paced: {
    ...pacedTrainSchedule.paced,
    exceptions: [
      {
        key: 'occurrence_1_0',
        id: 42,
        occurrence_index: 0,
        disabled: true,
      },
    ],
  },
};

export const peacedTrainWithExceptionsRollingStock: PacedTrainWithDetails = {
  ...pacedTrainSchedule,
  paced: {
    ...pacedTrainSchedule.paced,
    exceptions: [
      {
        key: 'occurrence_1_1',
        id: 42,
        occurrence_index: 1,
        train_name: { value: 'Exception Train RS 1' },
        rolling_stock: {
          rolling_stock_name: 'low-rs',
          comfort: 'STANDARD',
        },
      },
    ],
  },
};

export const BASE_OCCURRENCE = {
  stopsCount: 5,
  category: { main_category: 'HIGH_SPEED_TRAIN' as TrainMainCategory },
  rollingStock,
  disabled: false,
  exception: undefined,
  summary: undefined,
};

export const occurrence1: Occurrence = {
  ...BASE_OCCURRENCE,
  id: 'indexedoccurrence_1_0' as OccurrenceId,
  trainName: 'Paced Train 1',
  startTime: new Date('2026-06-09T08:00:00.000Z'),
  occurrenceIndex: 0,
};

export const occurrence2 = {
  ...BASE_OCCURRENCE,
  id: 'indexedoccurrence_1_1' as OccurrenceId,
  trainName: 'Paced Train 3',
  startTime: new Date('2026-06-09T08:45:00.000Z'),
  occurrenceIndex: 1,
};

export const occurrence3 = {
  ...BASE_OCCURRENCE,
  id: 'indexedoccurrence_1_2',
  trainName: 'Paced Train 5',
  startTime: new Date('2026-06-09T09:30:00.000Z'),
  occurrenceIndex: 2,
};

export const addedExceptionOccurrence = {
  ...BASE_OCCURRENCE,
  id: 'exception_1_0' as OccurrenceId,
  trainName: 'Added Exception Train',
  startTime: new Date('2026-06-09T10:00:00Z'),
  exception: {
    exceptionChangeGroups: {
      start_time: {
        value: new Date('2026-06-09T10:00:00Z').getTime(),
      },
      train_name: {
        value: 'Added Exception Train',
      },
    },
    id: 0,
  },
};

export const pacedTrainWithAddedException: PacedTrainWithDetails = {
  ...pacedTrainSchedule,
  paced: {
    ...pacedTrainSchedule.paced,
    exceptions: [
      {
        key: addedExceptionOccurrence.id,
        id: addedExceptionOccurrence.exception.id,
        ...addedExceptionOccurrence.exception.exceptionChangeGroups,
        disabled: false,
      },
    ],
  },
};
