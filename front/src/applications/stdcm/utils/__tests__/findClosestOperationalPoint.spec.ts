import { describe, it, expect } from 'vitest';

import type { SuggestedOP } from 'modules/timetableItem/types';

import { findClosestOperationalPoint } from '../formatConflicts';

const operationalPoints: SuggestedOP[] = [
  {
    pathStepId: 'step1',
    opId: 'id1',
    offsetOnTrack: 10,
    track: '123456',
    name: 'A',
    positionOnPath: 0,
  },
  {
    pathStepId: 'step2',
    opId: 'id2',
    offsetOnTrack: 10,
    track: '123456',
    name: 'B',
    positionOnPath: 100,
  },
  {
    pathStepId: 'step3',
    opId: 'id3',
    offsetOnTrack: 10,
    track: '123456',
    name: 'C',
    positionOnPath: 200,
  },
  {
    pathStepId: 'step4',
    opId: 'id4',
    offsetOnTrack: 10,
    track: '123456',
    name: 'D',
    positionOnPath: 300,
  },
];

describe('findClosestOperationalPoint', () => {
  it('should find the closest operational point before a position', () => {
    const result = findClosestOperationalPoint(operationalPoints, 250, 'before');
    expect(result.name).toBe('C');
  });

  it('should find the closest operational point after a position', () => {
    const result = findClosestOperationalPoint(operationalPoints, 150, 'after');
    expect(result.name).toBe('C');
  });

  it('should return the first operational point if the position is 0', () => {
    const resultBefore = findClosestOperationalPoint(operationalPoints, 0, 'before');
    expect(resultBefore.name).toBe('A');
  });
  it('should return the last operational point if the position equals the path length', () => {
    const resultAfter = findClosestOperationalPoint(operationalPoints, 300, 'after');
    expect(resultAfter.name).toBe('D');
  });
});
