import { describe, expect, it } from 'vitest';

import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import type { SimulatedException } from 'modules/trainSchedule/types';

import { returnOccurrenceExceptionRollingStock } from '../useOccurrences';

describe('returnOccurrenceExceptionRollingStock', () => {
  const rollingStock = { name: 'Rolling Stock 1' } as LightRollingStockWithLiveries;
  const rollingStockList = [
    { name: 'Rolling Stock 1' } as LightRollingStockWithLiveries,
    { name: 'Rolling Stock 2' } as LightRollingStockWithLiveries,
    { name: 'Rolling Stock 3' } as LightRollingStockWithLiveries,
  ];

  it('should return the rolling stock from the exception if it exists in the rolling stock list', () => {
    const exception = {
      rolling_stock: { rolling_stock_name: 'Rolling Stock 2' },
    } as SimulatedException;
    const result = returnOccurrenceExceptionRollingStock({
      exception,
      rollingStock,
      rollingStockList,
    });
    expect(result).toEqual(rollingStockList[1]);
  });

  it('should return the original rolling stock if the exception does not have a rolling stock', () => {
    const exception = {} as SimulatedException;
    const result = returnOccurrenceExceptionRollingStock({
      exception,
      rollingStock,
      rollingStockList,
    });
    expect(result).toEqual(rollingStock);
  });

  it('should return undefined if the exception has a rolling stock that is not in the rolling stock list', () => {
    const exception = {
      rolling_stock: { rolling_stock_name: 'Rolling Stock 4' },
    } as SimulatedException;
    const result = returnOccurrenceExceptionRollingStock({
      exception,
      rollingStock,
      rollingStockList,
    });
    expect(result).toBeUndefined();
  });

  it('should return the original rolling stock if the rolling stock list is null', () => {
    const exception = {
      rolling_stock: { rolling_stock_name: 'Rolling Stock 2' },
    } as SimulatedException;
    const result = returnOccurrenceExceptionRollingStock({
      exception,
      rollingStock,
      rollingStockList: null,
    });
    expect(result).toEqual(rollingStock);
  });

  it('should return the original rolling stock if the exception is undefined', () => {
    const result = returnOccurrenceExceptionRollingStock({
      exception: undefined,
      rollingStock,
      rollingStockList,
    });
    expect(result).toEqual(rollingStock);
  });
});
