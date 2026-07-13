import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import type { PacedTrainWithDetails } from 'modules/trainSchedule/types';
import { Duration } from 'utils/duration';

import useOccurrences from '../useOccurrences';

const ROLLING_STOCK_NAME = 'fast-rs';
const PACED_INTERVAL = Duration.parse('PT45M');
const PACED_TIME_WINDOW = Duration.parse('PT2H');

const rollingStock = {
  name: ROLLING_STOCK_NAME,
  effort_curves: { modes: {} },
} as LightRollingStockWithLiveries;

const pacedTrainSchedule: PacedTrainWithDetails = {
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

const BASE_OCCURRENCE = {
  stopsCount: 5,
  category: { main_category: 'HIGH_SPEED_TRAIN' },
  rollingStock,
  disabled: false,
  exception: undefined,
  summary: undefined,
};

const occurrence1 = {
  ...BASE_OCCURRENCE,
  id: 'indexedoccurrence_1_0',
  trainName: 'Paced Train 1',
  startTime: new Date('2026-06-09T08:00:00.000Z'),
  occurrenceIndex: 0,
};

const occurrence2 = {
  ...BASE_OCCURRENCE,
  id: 'indexedoccurrence_1_1',
  trainName: 'Paced Train 3',
  startTime: new Date('2026-06-09T08:45:00.000Z'),
  occurrenceIndex: 1,
};

const occurrence3 = {
  ...BASE_OCCURRENCE,
  id: 'indexedoccurrence_1_2',
  trainName: 'Paced Train 5',
  startTime: new Date('2026-06-09T09:30:00.000Z'),
  occurrenceIndex: 2,
};

describe('useOccurrences', () => {
  it('should return occurrences based on paced train', () => {
    const rollingStockList = [rollingStock];
    const { result } = renderHook(() => useOccurrences(pacedTrainSchedule, rollingStockList));
    expect(result.current).toEqual({
      occurrencesCount: 3,
      occurrences: [occurrence1, occurrence2, occurrence3],
    });
  });

  it('should return occurrences with exceptions (occurrence modified)', () => {
    const rollingStockList = [rollingStock];

    const pacedTrainWithExceptions: PacedTrainWithDetails = {
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

    const { result } = renderHook(() => useOccurrences(pacedTrainWithExceptions, rollingStockList));

    expect(result.current).toEqual({
      occurrencesCount: 3,
      occurrences: [
        {
          ...occurrence1,
          trainName: 'Exception Train 1',
          startTime: new Date('2026-06-09T08:05:00Z'),
          disabled: false,
          exception: {
            id: 42,
            exceptionChangeGroups: {
              train_name: { value: 'Exception Train 1' },
              start_time: { value: new Date('2026-06-09T08:05:00Z').getTime() },
            },
          },
        },
        occurrence2,
        occurrence3,
      ],
    });
  });

  it('should return occurrences with exceptions (exception added)', () => {
    const rollingStockList = [rollingStock];

    const pacedTrainWithAddedException: PacedTrainWithDetails = {
      ...pacedTrainSchedule,
      paced: {
        ...pacedTrainSchedule.paced,
        exceptions: [
          {
            key: 'exception_1_0',
            id: 0,
            train_name: { value: 'Added Exception Train' },
            start_time: { value: new Date('2026-06-09T10:00:00Z').getTime() },
            disabled: false,
          },
        ],
      },
    };

    const { result } = renderHook(() =>
      useOccurrences(pacedTrainWithAddedException, rollingStockList)
    );

    expect(result.current).toEqual({
      occurrencesCount: 4,
      occurrences: [
        occurrence1,
        occurrence2,
        occurrence3,
        {
          ...BASE_OCCURRENCE,
          id: 'exception_1_0',
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
        },
      ],
    });
  });

  it('should update count if an occurrence is disabled', () => {
    const rollingStockList = [rollingStock];

    const pacedTrainWithDisabledOccurrence: PacedTrainWithDetails = {
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

    const { result } = renderHook(() =>
      useOccurrences(pacedTrainWithDisabledOccurrence, rollingStockList)
    );

    expect(result.current).toEqual({
      occurrencesCount: 2,
      occurrences: [
        { ...occurrence1, disabled: true, exception: { id: 42, exceptionChangeGroups: {} } },
        occurrence2,
        occurrence3,
      ],
    });
  });

  it('should return occurrence with peaced train rolling stock if rolling stock list is null', () => {
    const peacedTrainWithExceptionsRollingStock: PacedTrainWithDetails = {
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
    const { result } = renderHook(() =>
      useOccurrences(peacedTrainWithExceptionsRollingStock, null)
    );
    expect(result.current).toEqual({
      occurrencesCount: 3,
      occurrences: [
        occurrence1,
        {
          ...occurrence2,
          trainName: 'Exception Train RS 1',
          exception: {
            id: 42,
            exceptionChangeGroups: {
              train_name: { value: 'Exception Train RS 1' },
              rolling_stock: {
                rolling_stock_name: 'low-rs',
                comfort: 'STANDARD',
              },
            },
          },
        },
        occurrence3,
      ],
    });
  });
});
