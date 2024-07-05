/* eslint-disable prefer-destructuring, no-plusplus */
import along from '@turf/along';
import distance from '@turf/distance';
import { point, type BBox } from '@turf/helpers';
import length from '@turf/length';
import type { Feature, FeatureCollection, LineString, Point, Polygon, Position } from 'geojson';
import _, { first, last, mapValues } from 'lodash';
import type { MapGeoJSONFeature } from 'maplibre-gl';
import WebMercatorViewport from 'viewport-mercator-project';

import { type EditoastType, LAYER_TO_EDITOAST_DICT, type Layer } from 'applications/editor/consts';
import { getMixedEntities } from 'applications/editor/data/api';
import { flattenEntity } from 'applications/editor/data/utils';
import vec, { type Vec2 } from 'common/Map/WarpedMap/core/vec-lib';
import type { Viewport } from 'reducers/map';
import type { AppDispatch } from 'store';

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
  if (lengthToAdd < 0) throw new Error('lengthToAdd must be positive');

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

/*
 * Data helpers:
 */
const OSRD_BATCH_SIZE = 500;
export async function getImprovedOSRDData(
  infra: number,
  data: Partial<Record<Layer, FeatureCollection>>,
  dispatch: AppDispatch
): Promise<Record<string, Feature>> {
  const queries = _(data)
    .flatMap((collection: FeatureCollection, layerType: Layer) => {
      const editoastType = LAYER_TO_EDITOAST_DICT[layerType];
      return collection.features.flatMap((feature) =>
        feature.properties?.fromEditoast || typeof feature.properties?.id !== 'string'
          ? []
          : [
              {
                id: feature.properties.id,
                type: editoastType,
              },
            ]
      );
    })
    .take(OSRD_BATCH_SIZE)
    .value() as unknown as { id: string; type: EditoastType }[];

  if (!queries.length) return {};

  return mapValues(await getMixedEntities(infra, queries, dispatch), (e) =>
    flattenEntity({
      ...e,
      properties: {
        ...e.properties,
        fromEditoast: true,
      },
    })
  );
}

/**
 * This helper takes a MapboxGeoJSONFeature (ie a data item extracted from a MapLibre instance through the
 * `querySourceFeatures` method), and returns a proper and clean GeoJSON Feature object.
 */
export function simplifyFeature(feature: MapGeoJSONFeature): Feature {
  return {
    type: 'Feature',
    id: feature.id,
    properties: { ...feature.properties, sourceLayer: feature.sourceLayer },
    // eslint-disable-next-line no-underscore-dangle
    geometry: feature.geometry || feature._geometry,
  };
}

export function computeBBoxViewport(boundingBox: BBox | Position, initialViewport: Viewport) {
  const [minLng, minLat, maxLng, maxLat] = boundingBox;
  const viewportTemp = new WebMercatorViewport({ ...initialViewport, width: 600, height: 400 });
  const { longitude, latitude, zoom } = viewportTemp.fitBounds(
    [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    { padding: 40 }
  );

  return {
    ...initialViewport,
    longitude,
    latitude,
    zoom: zoom > 5 ? zoom : 5,
  };
}

/**
 * Zoom helpers:
 */

export function zoomToFeature(
  boundingBox: BBox | Position,
  mapViewport: Viewport,
  updateExtViewport: (viewport: Viewport) => void
) {
  const newViewport = computeBBoxViewport(boundingBox, mapViewport);
  updateExtViewport(newViewport);
}
