import { describe, it, expect } from 'vitest';

import computeOccurrenceName from '../computeOccurrenceName';

describe('computeOccurrenceName', () => {
  it('should properly compute occurrence name', () => {
    expect(computeOccurrenceName('trainName', 0)).toEqual('trainName 1');
    expect(computeOccurrenceName('trainName 1', 1)).toEqual('trainName 3');
    expect(computeOccurrenceName('trainName-2 3', 3)).toEqual('trainName-2 9');
    expect(computeOccurrenceName('trainName-2', 3)).toEqual('trainName-2 7');
    expect(computeOccurrenceName('12345', 2)).toEqual('12349');
    expect(computeOccurrenceName('12345 1', 2)).toEqual('12345 5');
    expect(computeOccurrenceName('1', 2)).toEqual('5');
  });
});
