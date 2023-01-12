import { jouleToKwh } from 'utils/physics';

describe('jouleToKwh', () => {
  it('should return value in kwh', () => {
    expect(jouleToKwh(450000)).toEqual(0.125);
    expect(jouleToKwh(3600000)).toEqual(1);
  });
  it('should return value in kwh rounded up', () => {
    expect(jouleToKwh(450000, true)).toEqual(1);
  });
});
