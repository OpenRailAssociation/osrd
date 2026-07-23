import { describe, expect, it } from 'vitest';

import { getConflictRect, type Conflict } from '../ConflictLayer';

const getTimePixel = (time: number) => time * 10;
const getSpacePixel = (space: number) => space * 5;

const EXPECTED_RECT = { x: 10, y: 10, width: 20, height: 20 };

describe('getConflictRect', () => {
  it('computes the nominal rect for ordered inputs', () => {
    const conflict: Conflict = { timeStart: 1, timeEnd: 3, spaceStart: 2, spaceEnd: 6 };
    expect(getConflictRect(conflict, getTimePixel, getSpacePixel)).toEqual(EXPECTED_RECT);
  });

  it('normalizes the origin and width when timeStart > timeEnd', () => {
    const conflict: Conflict = { timeStart: 3, timeEnd: 1, spaceStart: 2, spaceEnd: 6 };
    expect(getConflictRect(conflict, getTimePixel, getSpacePixel)).toEqual(EXPECTED_RECT);
  });

  it('normalizes the origin and height when spaceStart > spaceEnd', () => {
    const conflict: Conflict = { timeStart: 1, timeEnd: 3, spaceStart: 6, spaceEnd: 2 };
    expect(getConflictRect(conflict, getTimePixel, getSpacePixel)).toEqual(EXPECTED_RECT);
  });

  it('produces the same rect as the ordered case when both axes are reversed', () => {
    const conflict: Conflict = { timeStart: 3, timeEnd: 1, spaceStart: 6, spaceEnd: 2 };
    expect(getConflictRect(conflict, getTimePixel, getSpacePixel)).toEqual(EXPECTED_RECT);
  });
});
