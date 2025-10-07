import along from '@turf/along';
import turfDistance from '@turf/distance';
import { point, featureCollection, lineString, type Units } from '@turf/helpers';
import { getCoord } from '@turf/invariant';
import length from '@turf/length';
import type {
  Feature,
  Point,
  FeatureCollection,
  LineString,
  MultiLineString,
  Position,
} from 'geojson';
import { minBy } from 'lodash';

import type { GeoJsonLineString } from 'common/api/osrdEditoastApi';

export function getTangent(
  tangentPoint: Position,
  line: Feature<LineString>
): FeatureCollection<Point> {
  const index = line.geometry.coordinates.findIndex(
    (pos) => pos[0] === tangentPoint[0] && pos[1] === tangentPoint[1]
  );
  let index1 = index - 1;
  let index2 = index + 1;
  if (index === 0) {
    index1 = 0;
    index2 = 1;
  }
  if (index === line.geometry.coordinates.length - 1) {
    index1 = index - 1;
    index2 = index;
  }
  const point1 = point(line.geometry.coordinates[index1]);
  const point2 = point(line.geometry.coordinates[index2]);
  return featureCollection([point1, point2]);
}

export function lengthFromLineCoordinates(coordinates?: Position[]) {
  if (coordinates) {
    return length(lineString(coordinates));
  }
  return NaN;
}

export type NearestPointOnLine = Feature<Point> & {
  properties: {
    index: number;
    dist: number;
    location: number;
  };
};
/**
 * This function has the same signature than the one of turf, but it is more precise.
 *
 * You can check those links for references :
 * - https://github.com/Turfjs/turf/issues/1440
 * - https://github.com/Turfjs/turf/issues/2023
 *
 * For each segment, we compute the height from the point of the triangle
 * composed of the segment (BC) and the point (A),
 * and we check if A' (projection of A on BC) is in the segment (BC) by computing the angle for B & C
 *
 * Math reminder on triangle A,B & C where AB is the lenght of the segment:
 * - The height from the vextex A is `Ha = AB * SIN(AB,BC)`
 * Angle of vertex B (cosines law) is `AngleB = arccos((AB² + BC² - AC²) / (2 * AB * BC))`
 */
export function nearestPointOnLine(
  line: Feature<LineString> | LineString | Feature<MultiLineString> | MultiLineString,
  inPoint: Feature<Point> | Point | Position,
  options?: { units?: Units }
): NearestPointOnLine {
  // Handle multilines
  if (
    line.type === 'MultiLineString' ||
    (line.type === 'Feature' && line.geometry.type === 'MultiLineString')
  ) {
    const linesCoords =
      line.type === 'MultiLineString'
        ? line.coordinates
        : (line as Feature<MultiLineString>).geometry.coordinates;
    const nearestPoints = linesCoords.map((lineCoords) =>
      nearestPointOnLine({ type: 'LineString', coordinates: lineCoords }, inPoint, options)
    );
    return minBy(nearestPoints, (i) => i.properties.dist) || nearestPoints[0];
  }

  const pointA = getCoord(inPoint);
  const lineCoords: Position[] =
    line.type === 'Feature' ? (line as Feature<LineString>).geometry.coordinates : line.coordinates;

  const closestPointPerSegment: Array<{ point: Position; dist: number; index: number }> = [];
  for (let n = 1; n < lineCoords.length; n += 1) {
    const pointB = lineCoords[n - 1];
    const pointC = lineCoords[n];

    const lengthAB = turfDistance(pointA, pointB);

    if (lengthAB === 0) {
      closestPointPerSegment.push({ point: pointB, index: n - 1, dist: lengthAB });
    } else {
      const lengthAC = turfDistance(pointA, pointC);
      const lengthBC = turfDistance(pointB, pointC);
      const angleB = Math.acos(
        (lengthAB ** 2 + lengthBC ** 2 - lengthAC ** 2) / (2 * lengthAB * lengthBC)
      );
      const heightA = lengthAB * Math.sin(angleB);

      // we compute the BA'
      const lengthBAPrime = lengthAB * Math.cos(angleB);

      if (angleB >= 90 * (Math.PI / 180)) {
        // Closest is B : projection A' is outside BC, and before B
        closestPointPerSegment.push({ point: pointB, index: n - 1, dist: lengthAB });
      } else if (lengthBAPrime > lengthBC) {
        // Closest is C : projection A' is outside BC, and after C
        closestPointPerSegment.push({ point: pointC, index: n - 1, dist: lengthAC });
      } else {
        // Closest is in BC
        // we do the ratio BA' / BC
        const ratio = lengthBAPrime / lengthBC;
        // We reduce the vector AB by the ratio
        const vectorBAPrime = [(pointC[0] - pointB[0]) * ratio, (pointC[1] - pointB[1]) * ratio];
        // The new result is point B on which we apply the vector
        const pointOnSegmentLine = [pointB[0] + vectorBAPrime[0], pointB[1] + vectorBAPrime[1]];

        closestPointPerSegment.push({ point: pointOnSegmentLine, index: n - 1, dist: heightA });
      }
    }
  }

  const result = minBy(closestPointPerSegment, 'dist') || {
    point: lineCoords[0],
    index: 0,
    dist: turfDistance(pointA, lineCoords[0]),
  };

  return point(result.point, {
    dist: result.dist,
    index: result.index,
    location: length(lineString([...lineCoords.slice(0, result.index + 1), result.point]), options),
  });
}

/**
 * Given a track's geometry and length and an offset from the start of the track (in mm),
 * returns the coordinates of the point for the given offset.
 */
export function getPointOnTrackCoordinates(
  geometry: GeoJsonLineString,
  trackLength: number, // in mm
  infraPositionOnTrack: number // in mm
): Position {
  const pathLineString = lineString(geometry.coordinates);
  const geometryTrackLength = length(pathLineString, { units: 'millimeters' });
  const infraTrackLength = trackLength;
  // TODO TS2 : when adapting train update check that this computation works properly
  const geometryDistanceAlongTrack =
    infraPositionOnTrack * (geometryTrackLength / infraTrackLength);
  return along(pathLineString, geometryDistanceAlongTrack, { units: 'millimeters' }).geometry
    .coordinates;
}

export function getBarycenter(coords: Position[]): Position {
  const n = coords.length;
  if (n === 0) throw new Error('No coordinates provided');
  const sum = coords.reduce((acc, [lon, lat]) => [acc[0] + lon, acc[1] + lat], [0, 0]);
  return [sum[0] / n, sum[1] / n];
}
