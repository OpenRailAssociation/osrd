import { describe, it, expect } from 'vitest';

import {
  formatEditoastTrainIdToPacedTrainId,
  formatEditoastTrainIdToTrainScheduleId,
} from 'utils/trainId';

import { getBatchPackage } from '../batch';

const trainIds = [...Array(25)].map((_, i) =>
  i % 2 === 0 ? formatEditoastTrainIdToTrainScheduleId(i) : formatEditoastTrainIdToPacedTrainId(i)
);
const BATCH_SIZE = 10;

describe('getBatchPackage', () => {
  it('should return the first 10 ids', () => {
    const lowerIndex = 0;
    const trainIdsPackage = getBatchPackage(lowerIndex, trainIds, BATCH_SIZE);
    expect(trainIdsPackage).toEqual([
      'trainschedule-0',
      'paced-1',
      'trainschedule-2',
      'paced-3',
      'trainschedule-4',
      'paced-5',
      'trainschedule-6',
      'paced-7',
      'trainschedule-8',
      'paced-9',
    ]);
  });

  it('should return the second 10 ids', () => {
    const lowerIndex = 10;
    const trainIdsPackage = getBatchPackage(lowerIndex, trainIds, BATCH_SIZE);
    expect(trainIdsPackage).toEqual([
      'trainschedule-10',
      'paced-11',
      'trainschedule-12',
      'paced-13',
      'trainschedule-14',
      'paced-15',
      'trainschedule-16',
      'paced-17',
      'trainschedule-18',
      'paced-19',
    ]);
  });

  it('should return the last 5 ids', () => {
    const lowerIndex = 20;
    const trainIdsPackage = getBatchPackage(lowerIndex, trainIds, BATCH_SIZE);
    expect(trainIdsPackage).toEqual([
      'trainschedule-20',
      'paced-21',
      'trainschedule-22',
      'paced-23',
      'trainschedule-24',
    ]);
  });
});
