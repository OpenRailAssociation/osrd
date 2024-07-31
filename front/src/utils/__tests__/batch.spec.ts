import { getBatchPackage } from '../batch';

const trainIds = [...Array(25)].map((_, i) => i);
const BATCH_SIZE = 10;

describe('getBatchPackage', () => {
  it('should return the first 10 ids', () => {
    const lowerIndex = 0;
    const trainIdsPackage = getBatchPackage(lowerIndex, trainIds, BATCH_SIZE);
    expect(trainIdsPackage).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('should return the second 10 ids', () => {
    const lowerIndex = 10;
    const trainIdsPackage = getBatchPackage(lowerIndex, trainIds, BATCH_SIZE);
    expect(trainIdsPackage).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('should return the last 5 ids', () => {
    const lowerIndex = 20;
    const trainIdsPackage = getBatchPackage(lowerIndex, trainIds, BATCH_SIZE);
    expect(trainIdsPackage).toEqual([20, 21, 22, 23, 24]);
  });
});
