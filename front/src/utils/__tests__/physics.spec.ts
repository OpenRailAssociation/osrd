import { jouleToKwh, minutePer100km } from 'utils/physics';

describe('jouleToKwh', () => {
  it('should return value in kwh', () => {
    expect(jouleToKwh(450000)).toEqual(0.125);
    expect(jouleToKwh(3600000)).toBe(1);
  });
  it('should return value in kwh rounded up', () => {
    expect(jouleToKwh(450000, true)).toBe(1);
  });
});

describe('minutePer100km', () => {
  it('should return margin in min/100km', () => {
    const seconds = 60;
    const metres = 1000;
    expect(minutePer100km(seconds, metres)).toEqual(100);
  });
});
