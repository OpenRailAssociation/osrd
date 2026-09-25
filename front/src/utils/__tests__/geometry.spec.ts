import { point, lineString, featureCollection } from '@turf/helpers';
import type { Feature, Point } from 'geojson';
import { describe, it, expect } from 'vitest';

import type {
  GeoJsonLineString as LineString,
  CorePropertyGeometryProjection as GeometryProjection,
} from 'common/api/osrdEditoastApi';
import { convertGeomTopoTrackOffset, getTangent, nearestPointOnLine } from 'utils/geometry';

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

describe('topoGeomOffsetConversion', () => {
  const projection: GeometryProjection = {
    topo_offsets: [0, 1000, 1000, 3000],
    geom_offsets: [0, 700, 900, 2500],
  };
  it('topo to geom', () => {
    const geomOffset1 = convertGeomTopoTrackOffset(projection, 500, 'topo_to_geom');
    expect(geomOffset1).toEqual(350);
    const geomOffset2 = convertGeomTopoTrackOffset(projection, 0, 'topo_to_geom');
    expect(geomOffset2).toEqual(0);
    const geomOffset3 = convertGeomTopoTrackOffset(projection, 3000, 'topo_to_geom');
    expect(geomOffset3).toEqual(2500);
  });
  it('geom to topo', () => {
    const topoOffset1 = convertGeomTopoTrackOffset(projection, 1200, 'geom_to_topo');
    expect(topoOffset1).toEqual(1375);
    const topoOffset2 = convertGeomTopoTrackOffset(projection, 800, 'geom_to_topo');
    expect(topoOffset2).toEqual(1000);
  });
  it('edge case: several identic input offsets', () => {
    const geomOffset = convertGeomTopoTrackOffset(projection, 1000, 'topo_to_geom');
    expect(geomOffset).toEqual(800);
  });
});
