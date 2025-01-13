import { describe, it, expect } from 'vitest';

import { calculateTimeDifferenceInDays } from 'utils/timeManipulation';

describe('calculateTimeDifferenceInDays', () => {
  it('should handle undefined dates', () => {
    expect(calculateTimeDifferenceInDays(undefined, new Date(2024, 1, 1, 15))).toEqual(undefined);
    expect(calculateTimeDifferenceInDays(new Date(2024, 1, 1, 15), undefined)).toEqual(undefined);
    expect(calculateTimeDifferenceInDays(undefined, undefined)).toEqual(undefined);
  });
  it('should handle 2 dates on the same day', () => {
    expect(
      calculateTimeDifferenceInDays(new Date(2024, 1, 1, 10), new Date(2024, 1, 1, 15))
    ).toEqual(0);
  });
  it('should handle 2 dates not on the same day', () => {
    expect(
      calculateTimeDifferenceInDays(new Date(2024, 1, 1, 10), new Date(2024, 1, 4, 15))
    ).toEqual(3);
  });
  it('should handle 2 dates not on the same day with less than a day in duration', () => {
    expect(
      calculateTimeDifferenceInDays(new Date(2024, 1, 1, 23), new Date(2024, 1, 2, 2))
    ).toEqual(1);
  });
});
