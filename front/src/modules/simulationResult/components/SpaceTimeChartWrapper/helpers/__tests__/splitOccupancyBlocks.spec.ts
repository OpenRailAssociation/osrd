import type { OccupancyBlock } from '@osrd-project/ui-charts';
import { describe, it, expect } from 'vitest';

import { splitOccupancyBlocks } from '../utils';

const BLOCK: OccupancyBlock = {
  spaceStart: 0,
  spaceEnd: 100,
  timeStart: 0,
  timeEnd: 1000,
  color: 'red',
};

describe('splitOccupancyBlocks', () => {
  it('should return the blocks untouched when there is no position to split at', () => {
    expect(splitOccupancyBlocks([BLOCK], [])).toEqual([BLOCK]);
  });

  it('should leave a block which does not span any position untouched', () => {
    expect(splitOccupancyBlocks([BLOCK], [150])).toEqual([BLOCK]);
  });

  it('should leave a block bounded by a position untouched', () => {
    expect(splitOccupancyBlocks([BLOCK], [0, 100])).toEqual([BLOCK]);
  });

  it('should split a block spanning a position, keeping its time range on both parts', () => {
    expect(splitOccupancyBlocks([BLOCK], [40])).toEqual([
      { ...BLOCK, spaceStart: 0, spaceEnd: 40 },
      { ...BLOCK, spaceStart: 40, spaceEnd: 100 },
    ]);
  });

  it('should split a block at every position it spans, whatever their order', () => {
    const expected = [
      { ...BLOCK, spaceStart: 0, spaceEnd: 40 },
      { ...BLOCK, spaceStart: 40, spaceEnd: 70 },
      { ...BLOCK, spaceStart: 70, spaceEnd: 100 },
    ];

    expect(splitOccupancyBlocks([BLOCK], [40, 70])).toEqual(expected);
    expect(splitOccupancyBlocks([BLOCK], [70, 40])).toEqual(expected);
  });
});
