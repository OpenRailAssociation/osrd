import { describe, it, expect } from 'vitest';

import type { CurveStyleExceptionType } from 'modules/simulationResult/types';
import type { SimulatedException } from 'modules/trainSchedule/types';
import { Duration } from 'utils/duration';

import getPanelOccurrenceCounts from '../getPanelOccurrenceCounts';

const exception = (
  partial: { key: string } & Partial<Record<keyof SimulatedException, unknown>>
): SimulatedException => partial as SimulatedException;

const paced = (exceptions: SimulatedException[] = []) => ({
  timeWindow: new Duration({ hours: 1 }),
  interval: new Duration({ minutes: 10 }),
  exceptions,
});

const STD: CurveStyleExceptionType = 'start_time';
const TOD: CurveStyleExceptionType = 'path_and_schedule';

describe('getPanelOccurrenceCounts', () => {
  it('should count all indexed occurrences as compliant when there are no exceptions', () => {
    expect(getPanelOccurrenceCounts(paced(), STD)).toEqual({ compliant: 6, all: 6 });
  });

  it.each([
    { label: 'on the STD', exceptionType: STD, field: 'start_time' as const },
    { label: 'on the TOD', exceptionType: TOD, field: 'path_and_schedule' as const },
  ])(
    'should subtract a $label non-compliant override from the compliant count',
    ({ exceptionType, field }) => {
      const result = getPanelOccurrenceCounts(
        paced([exception({ key: 'e1', occurrence_index: 2, [field]: { value: 1000 } })]),
        exceptionType
      );
      expect(result).toEqual({ compliant: 5, all: 6 });
    }
  );

  it('should remove a disabled indexed occurrence from both counts', () => {
    const result = getPanelOccurrenceCounts(
      paced([exception({ key: 'e1', occurrence_index: 1, disabled: true })]),
      STD
    );
    expect(result).toEqual({ compliant: 5, all: 5 });
  });

  it('should add an active added exception to the total but not to compliant on the STD', () => {
    const result = getPanelOccurrenceCounts(
      paced([exception({ key: 'e1', start_time: { value: 5000 } })]),
      STD
    );
    expect(result).toEqual({ compliant: 6, all: 7 });
  });

  it('should count an added exception as compliant on the TOD when it does not override path_and_schedule', () => {
    const result = getPanelOccurrenceCounts(
      paced([exception({ key: 'e1', start_time: { value: 5000 } })]),
      TOD
    );
    expect(result).toEqual({ compliant: 7, all: 7 });
  });

  it('should ignore an indexed exception that does not override the relevant field', () => {
    const result = getPanelOccurrenceCounts(
      paced([exception({ key: 'e1', occurrence_index: 1, path_and_schedule: { value: 'foo' } })]),
      STD
    );
    expect(result).toEqual({ compliant: 6, all: 6 });
  });

  it('should handle a mix of exception types', () => {
    const result = getPanelOccurrenceCounts(
      paced([
        exception({ key: 'e1', occurrence_index: 0, disabled: true }),
        exception({ key: 'e2', occurrence_index: 2, start_time: { value: 1000 } }),
        exception({ key: 'e3', start_time: { value: 5000 } }),
      ]),
      STD
    );
    expect(result).toEqual({ compliant: 4, all: 6 });
  });
});
