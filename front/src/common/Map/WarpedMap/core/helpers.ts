/* eslint-disable prefer-destructuring, no-plusplus */
import { Feature, FeatureCollection, LineString, Point, Polygon, Position } from 'geojson';
import { clamp, first, keyBy, last } from 'lodash';
import length from '@turf/length';
import { featureCollection, point, polygon } from '@turf/helpers';
import along from '@turf/along';
import distance from '@turf/distance';

import vec, { Vec2 } from './vec-lib';
import { PolygonZone } from '../../../../types';

/**
 * Useful types:
 */
export type TriangleProperties = { triangleId: string };
export type Triangle = Feature<Polygon, TriangleProperties>;
export type BarycentricCoordinates = [number, number, number];
export type GridFeature = FeatureCollection<Polygon, TriangleProperties>;
export type GridIndex = Record<string, Triangle>;
export type Grids = {
  regular: GridFeature;
  warped: GridFeature;
};
export type PointsGrid = Record<number, Position>[];

/**
 * Path manipulation helpers:
 */
export function getSamples(
  line: Feature<LineString>,
  samples: number
): { step: number; points: Feature<Point>[] } {
  if (samples <= 1) throw new Error('samples must be an integer greater than 1');

  const points: Feature<Point>[] = [];
  const l = length(line, { units: 'meters' });
  const step = l / (samples - 1);
  for (let i = 0; i < samples; i++) {
    if (!i) {
      points.push(point(first(line.geometry.coordinates) as Position));
    } else if (i === samples - 1) {
      points.push(point(last(line.geometry.coordinates) as Position));
    } else {
      const at = clamp(step * i, 0, l);
      points.push(along(line, at, { units: 'meters' }));
    }
  }

  return { step, points };
}

export function extendLine(line: Feature<LineString>, lengthToAdd: number): Feature<LineString> {
  if (lengthToAdd <= 1) throw new Error('lengthToAdd must be a positive');

  const points = line.geometry.coordinates;
  const firstPoint = points[0] as Vec2;
  const second = points[1] as Vec2;
  const lastPoint = points[points.length - 1] as Vec2;
  const secondToLast = points[points.length - 2] as Vec2;

  return {
    ...line,
    geometry: {
      ...line.geometry,
      coordinates: [
        vec.add(
          firstPoint,
          vec.multiply(
            vec.vector(second, firstPoint),
            lengthToAdd / distance(second, firstPoint, { units: 'meters' })
          )
        ),
        ...points,
        vec.add(
          lastPoint,
          vec.multiply(
            vec.vector(secondToLast, lastPoint),
            lengthToAdd / distance(secondToLast, lastPoint, { units: 'meters' })
          )
        ),
      ],
    },
  };
}

/**
 * Grid helpers:
 */
export function getGridIndex(grid: GridFeature): GridIndex {
  return keyBy(grid.features, (feature) => feature.properties.triangleId);
}

export function featureToPointsGrid(grid: GridFeature, steps: number): PointsGrid {
  const points: PointsGrid = [];
  const gridIndex = getGridIndex(grid);
  const stripsPerSide = grid.features.length / steps / 2 / 2;

  for (let i = 0; i < steps; i++) {
    points[i] = points[i] || {};
    points[i + 1] = points[i + 1] || {};
    for (let direction = -1; direction <= 1; direction += 2) {
      for (let j = 0; j < stripsPerSide; j++) {
        const inside = gridIndex[`step:${i}/strip:${direction * (j + 1)}/inside`];
        const outside = gridIndex[`step:${i}/strip:${direction * (j + 1)}/outside`];
        const [[p00, p10, p01]] = inside.geometry.coordinates;
        const [[p11]] = outside.geometry.coordinates;

        points[i][direction * j] = p00;
        points[i][direction * (j + 1)] = p01;
        points[i + 1][direction * j] = p10;
        points[i + 1][direction * (j + 1)] = p11;
      }
    }
  }

  return points;
}
export function pointsGridToFeature(points: PointsGrid): GridFeature {
  const grid = featureCollection([]) as GridFeature;
  const steps = points.length - 1;
  const stripsPerSide = (Object.keys(points[0]).length - 1) / 2;

  for (let i = 0; i < steps; i++) {
    for (let direction = -1; direction <= 1; direction += 2) {
      for (let j = 0; j < stripsPerSide; j++) {
        const p00 = points[i][direction * j];
        const p01 = points[i][direction * (j + 1)];
        const p10 = points[i + 1][direction * j];
        const p11 = points[i + 1][direction * (j + 1)];
        grid.features.push(
          polygon([[p00, p10, p01, p00]], {
            triangleId: `step:${i}/strip:${direction * (j + 1)}/inside`,
          }) as Triangle
        );
        grid.features.push(
          polygon([[p11, p10, p01, p11]], {
            triangleId: `step:${i}/strip:${direction * (j + 1)}/outside`,
          }) as Triangle
        );
      }
    }
  }

  return grid;
}

export function pointsGridToZone(points: PointsGrid): PolygonZone {
  const firstRow = points[0];
  const lastRow = points[points.length - 1];
  const stripsPerSide = (Object.keys(firstRow).length - 1) / 2;
  const border: Position[] = [];

  // Add first row:
  for (let i = -stripsPerSide; i <= stripsPerSide; i++) {
    border.push(points[0][i]);
  }

  // Add all intermediary rows:
  for (let i = 1, l = points.length - 1; i < l; i++) {
    border.push(points[i][stripsPerSide]);
    border.unshift(points[i][-stripsPerSide]);
  }

  // Add last row:
  for (let i = stripsPerSide; i >= -stripsPerSide; i--) {
    border.push(lastRow[i]);
  }

  // Close path:
  border.push(border[0]);

  return {
    type: 'polygon',
    points: border,
  };
}

/**
 * Triangle helpers:
 */
export function getBarycentricCoordinates(
  [x, y]: Position,
  {
    geometry: {
      coordinates: [[[x0, y0], [x1, y1], [x2, y2]]],
    },
  }: Triangle
): BarycentricCoordinates {
  const denominator = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / denominator;
  const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / denominator;
  const c = 1 - a - b;

  return [a, b, c];
}

export function isInTriangle([a, b, c]: BarycentricCoordinates): boolean {
  return a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1;
}

export function getPointInTriangle(
  [a, b, c]: BarycentricCoordinates,
  {
    geometry: {
      coordinates: [[[x0, y0], [x1, y1], [x2, y2]]],
    },
  }: Triangle
): Position {
  return [a * x0 + b * x1 + c * x2, a * y0 + b * y1 + c * y2];
}
