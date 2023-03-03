import { getTangent, getCurrentBearing } from 'utils/geometry';
import { point, lineString, featureCollection } from '@turf/helpers';

describe('getTangent', () => {
  describe('2 points segment', () => {
    it('should return the 2 points', () => {
      const line = lineString([
        [0, 0],
        [0, 1],
      ]);
      const result = getTangent([0, 0], line);
      const expected = featureCollection([point([0, 0]), point([0, 1])]);
      expect(result).toEqual(expected);
    });
    it('should return the 2 points also', () => {
      const line = lineString([
        [0, 0],
        [0, 1],
      ]);
      const result = getTangent([0, 1], line);
      const expected = featureCollection([point([0, 0]), point([0, 1])]);
      expect(result).toEqual(expected);
    });
  });
  describe('4 points line', () => {
    it('should return the 2 points on each side of the given point', () => {
      const line = lineString([
        [0, 0],
        [0.5, 0],
        [1, 0.5],
        [1, 1],
      ]);
      const result = getTangent([0.5, 0], line);
      const expected = featureCollection([point([0, 0]), point([1, 0.5])]);
      expect(result).toEqual(expected);
    });
  });
});

describe('getCurrentBearing', () => {
  const lines: Array<[Array<[number, number]>, number]> = [
    [
      [
        [0, 0],
        [0.5, 0],
      ],
      90,
    ],
    [
      [
        [0, 0],
        [0.5, 0],
        [1, 0.5],
      ],
      45,
    ],
    [
      [
        [0, 0],
        [0.5, 0],
        [1, 0.5],
        [1, 1],
      ],
      0,
    ],
  ];
  it.each(lines)('should return bearing', (l, expected) => {
    const line = lineString(l);
    const result = getCurrentBearing(line);
    expect(result).toBeCloseTo(expected, 2);
  });
});
