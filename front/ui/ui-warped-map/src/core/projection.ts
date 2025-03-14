import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { keyBy } from 'lodash';

import {
  type GridIndex,
  type Triangle,
  clip,
  getBarycentricCoordinates,
  getPointInTriangle,
  isInTriangle,
} from './helpers';
import { type Quad, getElements } from './quadtree';
import { type Zone } from './types';

export type Projection = (position: Position) => Position | null;

/**
 * This function maps the position of a point from one grid to another grid.
 * It can take either a GridIndex or a QuadTree for the source grid, but beware
 * that it is absolutely faster using a QuadTree.
 */
export function projectBetweenGrids(
  gridFrom: GridIndex,
  gridTo: GridIndex,
  position: Position
): Position | null;
export function projectBetweenGrids(
  quadTreeFrom: Quad<Triangle>,
  gridTo: GridIndex,
  position: Position
): Position | null;
export function projectBetweenGrids(
  from: GridIndex | Quad<Triangle>,
  gridTo: GridIndex,
  position: Position
): Position | null {
  let triangles: GridIndex;

  if (from.type === 'quad') {
    triangles = keyBy(
      getElements(position, from as Quad<Triangle>),
      (feature) => feature.properties.triangleId
    );
  } else {
    triangles = from as GridIndex;
  }

  const keys = Object.keys(triangles);
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i];
    const triangle = triangles[key];
    const barycentricCoordinates = getBarycentricCoordinates(position, triangle);
    if (isInTriangle(barycentricCoordinates)) {
      return getPointInTriangle(barycentricCoordinates, gridTo[key]);
    }
  }

  return null;
}

/**
 * This function projects any geometry, following a given projection function (ie. any function that transforms
 * coordinates into new coordinates).
 */
export function projectGeometry<G extends Geometry = Geometry>(
  geometry: G,
  project: Projection
): G | null {
  if (!geometry) return null;

  switch (geometry.type) {
    case 'Point': {
      const newCoordinates = project(geometry.coordinates);

      return newCoordinates
        ? {
            ...geometry,
            coordinates: newCoordinates,
          }
        : null;
    }
    case 'MultiPoint':
    case 'LineString': {
      const newPoints = geometry.coordinates.flatMap((p) => {
        const newP = project(p);
        return newP ? [newP] : [];
      });

      return newPoints.length
        ? {
            ...geometry,
            coordinates: newPoints,
          }
        : null;
    }
    case 'Polygon':
    case 'MultiLineString': {
      const newPaths = geometry.coordinates.flatMap((path) => {
        const newPath = path.flatMap((p) => {
          const newP = project(p);
          return newP ? [newP] : [];
        });

        return newPath.length ? [newPath] : [];
      });

      return newPaths.length
        ? {
            ...geometry,
            coordinates: newPaths,
          }
        : null;
    }
    case 'MultiPolygon': {
      const newMultiPaths = geometry.coordinates.flatMap((paths) => {
        const newPaths = paths.flatMap((path) => {
          const newPath = path.flatMap((p) => {
            const newP = project(p);
            return newP ? [newP] : [];
          });

          return newPath.length ? [newPath] : [];
        });

        return newPaths.length ? [newPaths] : [];
      });

      return newMultiPaths.length
        ? {
            ...geometry,
            coordinates: newMultiPaths,
          }
        : null;
    }
    case 'GeometryCollection':
      return {
        ...geometry,
        geometries: geometry.geometries.map((g) => projectGeometry(g, project)),
      };
    default:
      return geometry;
  }
}

/**
 * This function takes a geometry, a feature or a features collection, clips them into a given zone, and projects them
 * onto a given projection function. If everything is clipped out, then `null` is returned instead.
 */
export function clipAndProjectGeoJSON<T extends Geometry | Feature | FeatureCollection>(
  geojson: T,
  projection: Projection,
  zone: Zone
): T | null {
  if (geojson.type === 'FeatureCollection')
    return {
      ...geojson,
      features: geojson.features.flatMap((f) => {
        const res = clipAndProjectGeoJSON(f, projection, zone);
        return res ? [res] : [];
      }),
    };

  if (geojson.type === 'Feature') {
    const clippedFeature = clip(geojson, zone) as Feature | null;

    if (clippedFeature) {
      const newGeometry = projectGeometry(clippedFeature.geometry, projection);

      return newGeometry
        ? ({
            ...clippedFeature,
            geometry: newGeometry,
          } as T)
        : null;
    }

    return null;
  }

  return projectGeometry(geojson, projection) as T | null;
}
