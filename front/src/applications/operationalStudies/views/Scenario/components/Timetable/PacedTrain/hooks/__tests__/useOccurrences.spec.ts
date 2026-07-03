import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import useOccurrences from '../useOccurrences';
import {
  BASE_OCCURRENCE,
  occurrence1,
  occurrence2,
  occurrence3,
  pacedTrainSchedule,
  pacedTrainWithAddedException,
  pacedTrainWithDisabledOccurrence,
  pacedTrainWithExceptions,
  peacedTrainWithExceptionsRollingStock,
  rollingStock,
} from './consts';

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
          occurrenceIndex: undefined,
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
