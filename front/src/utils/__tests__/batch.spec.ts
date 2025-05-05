import { describe, it, expect } from 'vitest';

import { formatEditoastIdToPacedTrainId, formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import { getBatchPackage } from '../batch';

const trainIds = [...Array(25)].map((_, i) =>
  i % 2 === 0 ? formatEditoastIdToTrainScheduleId(i) : formatEditoastIdToPacedTrainId(i)
);
const BATCH_SIZE = 10;

describe('getBatchPackage', () => {
  it('should return the first 10 ids', () => {
    const lowerIndex = 0;
    const trainIdsPackage = getBatchPackage(lowerIndex, trainIds, BATCH_SIZE);
    expect(trainIdsPackage).toEqual([
      'trainschedule_0',
      'paced_1',
      'trainschedule_2',
      'paced_3',
      'trainschedule_4',
      'paced_5',
      'trainschedule_6',
      'paced_7',
      'trainschedule_8',
      'paced_9',
    ]);
  });

  it('should return the second 10 ids', () => {
    const lowerIndex = 10;
    const trainIdsPackage = getBatchPackage(lowerIndex, trainIds, BATCH_SIZE);
    expect(trainIdsPackage).toEqual([
      'trainschedule_10',
      'paced_11',
      'trainschedule_12',
      'paced_13',
      'trainschedule_14',
      'paced_15',
      'trainschedule_16',
      'paced_17',
      'trainschedule_18',
      'paced_19',
    ]);
  });

  it('should return the last 5 ids', () => {
    const lowerIndex = 20;
    const trainIdsPackage = getBatchPackage(lowerIndex, trainIds, BATCH_SIZE);
    expect(trainIdsPackage).toEqual([
      'trainschedule_20',
      'paced_21',
      'trainschedule_22',
      'paced_23',
      'trainschedule_24',
    ]);
  });
});
