import { jouleToKwh } from 'utils/physics';
import { describe, expect, it } from 'vitest';

describe('jouleToKwh', () => {
  it('should return value in kwh', () => {
    expect(jouleToKwh(450000)).toEqual(0.125);
    expect(jouleToKwh(3600000)).toBe(1);
  });
  it('should return value in kwh rounded up', () => {
    expect(jouleToKwh(450000, true)).toBe(1);
  });
});
