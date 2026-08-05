import { describe, it, expect } from 'vitest';

import type { PostSimilarTrainsApiResponse } from 'common/api/osrdEditoastApi';

import { mergeSimilarTrainSegments } from '..';

describe('mergeSimilarTrainSegments', () => {
  const makeSegments = (pathStepKeys: string[], trainNames: (string | null)[]) => {
    const segments: PostSimilarTrainsApiResponse['similar_trains'] = [];
    for (let i = 0; i < trainNames.length; i++) {
      segments.push({
        begin: pathStepKeys[i],
        end: pathStepKeys[i + 1],
        train: trainNames[i] ? { start_time: '00:00', train_name: trainNames[i]! } : null,
      });
    }
    return segments;
  };

  it('keeps the same segments when all groups are identical', () => {
    const group = makeSegments(['A', 'B', 'C'], ['Train1', 'Train1']);
    const result = mergeSimilarTrainSegments(group, group, null);
    expect(result).toEqual([
      { begin: 'A', end: 'C', train: { start_time: '00:00', train_name: 'Train1' } },
    ]);
  });

  it('prefers non-null trains from later groups', () => {
    const group1 = makeSegments(['A', 'B', 'C'], [null, 'Train1']);
    const group2 = makeSegments(['A', 'B', 'C'], ['Train2', null]);

    const result = mergeSimilarTrainSegments(group1, group2, null);
    expect(result).toEqual([
      { begin: 'A', end: 'B', train: { start_time: '00:00', train_name: 'Train2' } },
      { begin: 'B', end: 'C', train: { start_time: '00:00', train_name: 'Train1' } },
    ]);
  });

  it('merges consecutive segments that have the same train', () => {
    const group = makeSegments(['A', 'B', 'C', 'D'], ['Train1', 'Train1', 'Train2']);
    const result = mergeSimilarTrainSegments(group, null, null);
    expect(result).toEqual([
      { begin: 'A', end: 'C', train: { start_time: '00:00', train_name: 'Train1' } },
      { begin: 'C', end: 'D', train: { start_time: '00:00', train_name: 'Train2' } },
    ]);
  });

  it("uses the first group's order as reference", () => {
    const group1 = makeSegments(['A', 'B', 'C', 'D', 'E'], [null, 'Train1', 'Train2', null]);
    const group2 = makeSegments(['A', 'B', 'C', 'D', 'E'], ['Train3', 'Train3', null, null]);
    const group3 = makeSegments(['A', 'B', 'C', 'D', 'E'], [null, 'Train3', null, 'Train4']);

    const result = mergeSimilarTrainSegments(group1, group2, group3);
    expect(result).toEqual([
      { begin: 'A', end: 'B', train: { start_time: '00:00', train_name: 'Train3' } },
      { begin: 'B', end: 'C', train: { start_time: '00:00', train_name: 'Train1' } },
      { begin: 'C', end: 'D', train: { start_time: '00:00', train_name: 'Train2' } },
      { begin: 'D', end: 'E', train: { start_time: '00:00', train_name: 'Train4' } },
    ]);
  });
});
