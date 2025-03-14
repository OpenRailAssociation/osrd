import { describe, expect, it } from 'vitest';

import { getTickPattern } from '../components/utils';

describe('getTickPattern', () => {
  const fiveMinutes = ['05', '10', '20', '25', '35', '40', '50', '55'];
  const quarterHour = ['15', '45'];
  const halfHour = ['30'];
  const hour = ['00'];

  it('should return FIVE_MINUTES', () => {
    fiveMinutes.forEach((minutes) => {
      expect(getTickPattern(minutes)).toEqual('FIVE_MINUTES');
      expect(getTickPattern(minutes)).not.toEqual('MINUTE');
      expect(getTickPattern(minutes)).not.toEqual('QUARTER_HOUR');
      expect(getTickPattern(minutes)).not.toEqual('HALF_HOUR');
      expect(getTickPattern(minutes)).not.toEqual('HOUR');
    });
  });

  it('should return QUARTER_HOUR', () => {
    quarterHour.forEach((minutes) => {
      expect(getTickPattern(minutes)).toEqual('QUARTER_HOUR');
      expect(getTickPattern(minutes)).not.toEqual('MINUTE');
      expect(getTickPattern(minutes)).not.toEqual('FIVE_MINUTES');
      expect(getTickPattern(minutes)).not.toEqual('HALF_HOUR');
      expect(getTickPattern(minutes)).not.toEqual('HOUR');
    });
  });

  it('should return HALF_HOUR', () => {
    halfHour.forEach((minutes) => {
      expect(getTickPattern(minutes)).toEqual('HALF_HOUR');
      expect(getTickPattern(minutes)).not.toEqual('MINUTE');
      expect(getTickPattern(minutes)).not.toEqual('FIVE_MINUTES');
      expect(getTickPattern(minutes)).not.toEqual('QUARTER_HOUR');
      expect(getTickPattern(minutes)).not.toEqual('HOUR');
    });
  });

  it('should return HOUR', () => {
    hour.forEach((minutes) => {
      expect(getTickPattern(minutes)).toEqual('HOUR');
      expect(getTickPattern(minutes)).not.toEqual('MINUTE');
      expect(getTickPattern(minutes)).not.toEqual('FIVE_MINUTES');
      expect(getTickPattern(minutes)).not.toEqual('QUARTER_HOUR');
      expect(getTickPattern(minutes)).not.toEqual('HALF_HOUR');
    });
  });

  it('should return MINUTE', () => {
    expect(getTickPattern('01')).toEqual('MINUTE');
    expect(getTickPattern('01')).not.toEqual('HOUR');
    expect(getTickPattern('01')).not.toEqual('FIVE_MINUTES');
    expect(getTickPattern('01')).not.toEqual('QUARTER_HOUR');
    expect(getTickPattern('01')).not.toEqual('HALF_HOUR');
  });
});
