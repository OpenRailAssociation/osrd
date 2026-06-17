import { describe, expect, it } from 'vitest';

import type { PostSimilarTrainsApiResponse } from 'common/api/osrdEditoastApi';
import type { PathOperationalPoint } from 'modules/simulationResult/types';

import { addSecondaryCodesToSimilarTrains } from '../addSecondaryCodesToSimilarTrains';

const makePathOP = (
  opId: string,
  name: string,
  secondaryCode: string | null
): PathOperationalPoint =>
  ({
    opId,
    waypointId: `${opId}-${secondaryCode ?? 'no-code'}`,
    name,
    secondary_code: secondaryCode,
  }) as PathOperationalPoint;

const makeSimilarTrainSegment = (
  begin: string,
  end: string
): PostSimilarTrainsApiResponse['similar_trains'][number] => ({
  begin,
  end,
  train: {
    train_name: 'train 1',
    start_time: '2026-06-17T10:00:00Z',
  },
});

describe('addSecondaryCodesToSimilarTrains', () => {
  it('uses the first matching path occurrence for a repeated begin operational point', () => {
    const result = addSecondaryCodesToSimilarTrains(
      [makeSimilarTrainSegment('same-op', 'next-op')],
      [
        makePathOP('same-op', 'Same OP', 'FI'),
        makePathOP('next-op', 'Next OP', 'NO'),
        makePathOP('same-op', 'Same OP', 'WRONG'),
      ]
    );

    expect(result[0].begin).toEqual({
      name: 'Same OP',
      secondary_code: 'FI',
    });
  });

  it('resolves a merged segment end after the resolved begin occurrence', () => {
    const result = addSecondaryCodesToSimilarTrains(
      [makeSimilarTrainSegment('same-op', 'same-op')],
      [
        makePathOP('same-op', 'Same OP', 'FI'),
        makePathOP('middle-op', 'Middle OP', 'MI'),
        makePathOP('same-op', 'Same OP', 'LA'),
      ]
    );

    expect(result[0].begin).toEqual({
      name: 'Same OP',
      secondary_code: 'FI',
    });
    expect(result[0].end).toEqual({
      name: 'Same OP',
      secondary_code: 'LA',
    });
  });

  it('falls back to the segment id and dash code when the path operational point is missing', () => {
    const result = addSecondaryCodesToSimilarTrains(
      [makeSimilarTrainSegment('missing-begin', 'missing-end')],
      [makePathOP('known-op', 'Known OP', 'KO')]
    );

    expect(result[0].begin).toEqual({
      name: 'missing-begin',
      secondary_code: '—',
    });
    expect(result[0].end).toEqual({
      name: 'missing-end',
      secondary_code: '—',
    });
  });
});
