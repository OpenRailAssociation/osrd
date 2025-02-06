import { point, lineString, featureCollection } from '@turf/helpers';
import type { Feature, Point } from 'geojson';
import { describe, it, expect } from 'vitest';

import type { GeoJsonLineString as LineString } from 'common/api/osrdEditoastApi';
import { getTangent, getCurrentBearing, nearestPointOnLine } from 'utils/geometry';

import lineNorthenLatitude from './assets/line-northern-latitude.json';
import linePointOnLeft from './assets/line-point-on-left.json';
import linePointOnRight from './assets/line-point-on-right.json';
import linePointOnVertexUp from './assets/line-point-on-vertex-up.json';
import linePointOnVertex from './assets/line-point-on-vertex.json';
import line1 from './assets/line1.json';
import route1 from './assets/route1.json';
import route2 from './assets/route2.json';

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

describe('nearestPointOnLine', () => {
  it('should work', () => {
    [
      linePointOnLeft,
      linePointOnRight,
      lineNorthenLatitude,
      linePointOnVertex,
      linePointOnVertexUp,
      line1,
      route1,
      route2,
    ].forEach((features) => {
      const line = features.features[0] as Feature<LineString>;
      const pt = features.features[1] as Feature<Point>;
      const expected = features.features[2] as Feature<Point>;

      const result = nearestPointOnLine(line, pt);
      expect(result).toEqual(expected);
    });
  });
});
