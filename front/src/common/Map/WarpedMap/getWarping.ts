import bbox from '@turf/bbox';
import { lineString } from '@turf/helpers';
import type { BBox2d } from '@turf/helpers/dist/js/lib/geojson';
import simplify from '@turf/simplify';
import type { Feature, FeatureCollection, Geometry, LineString, Position } from 'geojson';

import {
  featureToPointsGrid,
  getGridIndex,
  getGrids,
  pointsGridToZone,
  straightenGrid,
} from 'common/Map/WarpedMap/core/grids';
import { extendLine, getSamples } from 'common/Map/WarpedMap/core/helpers';
import { clipAndProjectGeoJSON, projectBetweenGrids } from 'common/Map/WarpedMap/core/projection';
import { getQuadTree } from 'common/Map/WarpedMap/core/quadtree';

export type WarpingFunction = ReturnType<typeof getWarping>['transform'];

export default function getWarping(warpPath: Feature<LineString>) {
  // Simplify the input path to get something "straighter", so that we can see
  // in the final warped map the small curves of the initial path.
  // (Indeed, if we don't simplify the path, then in the final map the path will
  // appear as perfectly straight line, which makes it less identifiable)
  // TODO: Detect loops and remove them from the simplifiedPath
  const simplifiedPath = simplify(warpPath, { tolerance: 0.01 });

  // Cut the simplified path as N equal length segments
  const sample = getSamples(simplifiedPath, 15);
  const samplePath = lineString(sample.points.map((point) => point.geometry.coordinates));

  // Extend the sample, so that we can warp things right before and right
  // after the initial path:
  const extendedSamples = extendLine(samplePath, sample.step);
  const stepsCount = extendedSamples.geometry.coordinates.length - 1;

  // Generate our base grids, so that we can start shaping our transformation function:
  const { warped, original } = getGrids(extendedSamples);

  // Improve the warped grid, to get it less discontinuous:
  const betterOriginal = straightenGrid(original, stepsCount, { force: 0.8, iterations: 5 });

  // Index the grids:
  const warpedIndex = getGridIndex(warped);
  const originalQuadTree = getQuadTree(betterOriginal, 4);

  // Return projection function and exact warped grid boundaries:
  const zone = pointsGridToZone(featureToPointsGrid(betterOriginal, stepsCount));
  const projection = (position: Position) =>
    projectBetweenGrids(originalQuadTree, warpedIndex, position);

  // Finally we have a proper transformation function that takes any feature
  // as input, clips it to the grid contour polygon, and projects it the
  // regular grid:
  return {
    warpedBBox: bbox(warped) as BBox2d,
    transform: <T extends Geometry | Feature | FeatureCollection>(f: T, clip = true): T | null =>
      clipAndProjectGeoJSON(f, projection, zone, clip),
  };
}
