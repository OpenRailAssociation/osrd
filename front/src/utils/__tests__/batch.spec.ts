import { describe, it, expect } from 'vitest';

import { formatEditoastTrainIdToTrainScheduleId } from 'utils/trainId';

import { getBatchPackage } from '../batch';

// TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
const trainIds = [...Array(25)].map((_, i) => formatEditoastTrainIdToTrainScheduleId(i));
const BATCH_SIZE = 10;

describe('getBatchPackage', () => {
  it('should return the first 10 ids', () => {
    const lowerIndex = 0;
    const trainIdsPackage = getBatchPackage(lowerIndex, trainIds, BATCH_SIZE);
    expect(trainIdsPackage).toEqual([
      'trainschedule-0',
      'trainschedule-1',
      'trainschedule-2',
      'trainschedule-3',
      'trainschedule-4',
      'trainschedule-5',
      'trainschedule-6',
      'trainschedule-7',
      'trainschedule-8',
      'trainschedule-9',
    ]);
  });

  it('should return the second 10 ids', () => {
    const lowerIndex = 10;
    const trainIdsPackage = getBatchPackage(lowerIndex, trainIds, BATCH_SIZE);
    expect(trainIdsPackage).toEqual([
      'trainschedule-10',
      'trainschedule-11',
      'trainschedule-12',
      'trainschedule-13',
      'trainschedule-14',
      'trainschedule-15',
      'trainschedule-16',
      'trainschedule-17',
      'trainschedule-18',
      'trainschedule-19',
    ]);
  });

  it('should return the last 5 ids', () => {
    const lowerIndex = 20;
    const trainIdsPackage = getBatchPackage(lowerIndex, trainIds, BATCH_SIZE);
    expect(trainIdsPackage).toEqual([
      'trainschedule-20',
      'trainschedule-21',
      'trainschedule-22',
      'trainschedule-23',
      'trainschedule-24',
    ]);
  });
});
