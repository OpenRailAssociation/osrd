import { along } from '@turf/along';
import { bbox } from '@turf/bbox';
import { bboxClip } from '@turf/bbox-clip';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { distance } from '@turf/distance';
import { featureCollection, lineString, point } from '@turf/helpers';
import { intersect } from '@turf/intersect';
import { length } from '@turf/length';
import { lineIntersect } from '@turf/line-intersect';
import { lineSlice } from '@turf/line-slice';
import type {
  BBox,
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from 'geojson';
import { chunk, first, last } from 'lodash';
import { type GeoJSONFeature } from 'maplibre-gl';

import type { BBox2D, Zone } from './types';
import vec, { type Vec2 } from './vec-lib';

/*
 * Useful types:
 */
export type TriangleProperties = { triangleId: string };
export type Triangle = Feature<Polygon, TriangleProperties>;
export type BarycentricCoordinates = [number, number, number];
export type GridFeature = FeatureCollection<Polygon, TriangleProperties>;
export type GridIndex = Record<string, Triangle>;
export type Grids = {
  warped: GridFeature;
  original: GridFeature;
};
export type PointsGrid = Record<number, Position>[];

/*
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
      points.push(along(line, step * i, { units: 'meters' }));
    }
  }

  return { step, points };
}

/**
 * Given a line and a lengthToAdd, extend the line at its two extremities by lengthToAdd meters.
 */
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

/*
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

/**
 * This helper takes a MapboxGeoJSONFeature (ie a data item extracted from a MapLibre instance through the
 * `querySourceFeatures` method), and returns a proper and clean GeoJSON Feature object.
 */
export function simplifyFeature(feature: GeoJSONFeature, sourceLayer?: string): Feature {
  return {
    type: 'Feature',
    id: feature.id,
    properties: {
      ...feature.properties,
      sourceLayer,
    },
    geometry: feature.geometry || feature._geometry,
  };
}

/**
 * This helpers transforms a given Zone object to the related Feature object (mainly to use with
 * Turf).
 */
export function zoneToFeature(zone: Zone, close = false): Feature {
  switch (zone.type) {
    case 'rectangle': {
      const [[lat1, lon1], [lat2, lon2]] = zone.points;

      return {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [lat1, lon1],
              [lat2, lon1],
              [lat2, lon2],
              [lat1, lon2],
              [lat1, lon1],
            ],
          ],
        },
      };
    }
    case 'polygon': {
      return {
        type: 'Feature',
        properties: {},
        geometry: close
          ? {
              type: 'Polygon',
              coordinates: [[...zone.points, zone.points[0]]],
            }
          : {
              type: 'LineString',
              coordinates: zone.points,
            },
      };
    }
    default:
      throw new Error('Zone is neither a polygone, neither a rectangle');
  }
}

/**
 * Returns the BBox containing a given zone.
 */
export function zoneToBBox(zone: Zone): BBox {
  if (zone.type === 'rectangle') {
    const [[x1, y1], [x2, y2]] = zone.points;
    return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
  }

  return bbox(zoneToFeature(zone, true));
}

/**
 * Helper to clip a line on a polygon.
 */
export function intersectPolygonLine(
  poly: Feature<Polygon>,
  line: Feature<LineString | MultiLineString>
): Feature<LineString | MultiLineString> | null {
  const lines: Position[][] =
    line.geometry.type === 'MultiLineString'
      ? line.geometry.coordinates
      : [line.geometry.coordinates];
  const res: Feature<MultiLineString> = {
    type: 'Feature',
    properties: line.properties,
    geometry: {
      type: 'MultiLineString',
      coordinates: [],
    },
  };

  lines.forEach((l) => {
    if (l.length < 2) return;

    const firstPoint: Point = { type: 'Point', coordinates: l[0] };
    const lastPoint: Point = { type: 'Point', coordinates: l[l.length - 1] };
    let intersections: Point[] = lineIntersect(
      { type: 'LineString', coordinates: l },
      poly
    ).features.map((f) => f.geometry);

    if (booleanPointInPolygon(firstPoint, poly)) intersections = [firstPoint].concat(intersections);
    if (booleanPointInPolygon(lastPoint, poly)) intersections.push(lastPoint);

    const splitters = chunk(intersections, 2).filter((pair) => pair.length === 2) as [
      Point,
      Point,
    ][];

    splitters.forEach(([start, end]) => {
      res.geometry.coordinates.push(
        lineSlice(start.coordinates, end.coordinates, { type: 'LineString', coordinates: l })
          .geometry.coordinates
      );
    });
  });

  if (res.geometry.coordinates.length > 1) return res;
  if (res.geometry.coordinates.length === 1)
    return lineString(res.geometry.coordinates[0], res.properties);

  return null;
}

/**
 * This helper takes a Feature *or* a FeatureCollection and a bounding zone, and returns the input
 * Feature or FeatureCollection, but clipped inside the bounding zone. It filters out Points and
 * MultiPoints, and clips LineStrings and MultiLineStrings using @turf/bboxClip (when possible).
 */
export function clip<T extends Feature | FeatureCollection>(tree: T, zone: Zone): T | null {
  if (tree.type === 'FeatureCollection') {
    return {
      ...tree,
      features: (tree as FeatureCollection).features.flatMap((f) => {
        const res = clip(f, zone);
        if (!res) return [];
        return [res];
      }),
    };
  }

  if (tree.type === 'Feature') {
    const feature = tree as Feature;
    const type = feature.geometry.type;

    if (type === 'LineString' || type === 'MultiLineString') {
      if (zone.type === 'polygon') {
        const clipped = intersectPolygonLine(
          zoneToFeature(zone, true) as Feature<Polygon>,
          feature as Feature<LineString | MultiLineString>
        );
        return clipped ? ({ ...feature, ...clipped } as T) : null;
      }

      const clipped = bboxClip(
        feature as Feature<LineString | MultiLineString>,
        zoneToBBox(zone)
      ) as Feature<LineString | MultiLineString>;
      return clipped.geometry.coordinates.length ? (clipped as T) : null;
    }

    const polygon = zoneToFeature(zone, true).geometry as Polygon;

    if (type === 'Point') {
      return booleanPointInPolygon((feature as Feature<Point>).geometry.coordinates, polygon)
        ? tree
        : null;
    }

    if (type === 'MultiPoint') {
      const res: Feature<MultiPoint> = {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: feature.geometry.coordinates.filter((position) =>
            booleanPointInPolygon(position, polygon)
          ),
        },
      };

      return res.geometry.coordinates.length ? (res as T) : null;
    }

    if (type === 'Polygon' || type === 'MultiPolygon') {
      const res = intersect(
        featureCollection([
          feature as Feature<Polygon | MultiPolygon>,
          zoneToFeature(zone, true) as Feature<Polygon>,
        ])
      );

      return res && res.geometry.coordinates.length
        ? ({ ...feature, ...res, properties: feature.properties } as T)
        : null;
    }
  }

  return tree;
}

export function bboxAs2D(boundingBox: BBox): BBox2D {
  if (boundingBox.length !== 4) {
    throw new Error('Expected a 2D BBox');
  }
  return boundingBox;
}
