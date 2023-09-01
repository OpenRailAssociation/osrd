import bbox from '@turf/bbox';
import simplify from '@turf/simplify';
import { lineString } from '@turf/helpers';
import { BBox2d } from '@turf/helpers/dist/js/lib/geojson';
import { Feature, FeatureCollection, Geometry, LineString, Position } from 'geojson';

import { extendLine, getSamples } from 'common/Map/WarpedMap/core/helpers';
import { getQuadTree } from 'common/Map/WarpedMap/core/quadtree';
import {
  featureToPointsGrid,
  getGridIndex,
  getGrids,
  pointsGridToZone,
  straightenGrid,
} from 'common/Map/WarpedMap/core/grids';
import { clipAndProjectGeoJSON, projectBetweenGrids } from 'common/Map/WarpedMap/core/projection';

export type WarpingFunction = ReturnType<typeof getWarping>['transform'];

export default function getWarping(warpPath: Feature<LineString>) {
  // Simplify the input path to get something "straighter", so that we can see
  // in the final warped map the small curves of the initial path:
  // TODO: Detect loops and remove them from the simplifiedPath
  const simplifiedPath = simplify(warpPath, { tolerance: 0.01 });

  // Cut the simplified path as N equal length segments
  const sample = getSamples(simplifiedPath, 15);
  const samplePath = lineString(sample.points.map((point) => point.geometry.coordinates));

  // Extend the sample, so that we can warp things right before and right
  // after the initial path:
  const extendedSamples = extendLine(samplePath, sample.step);
  const steps = extendedSamples.geometry.coordinates.length - 1;

  // Generate our base grids, so that we can start shaping our transformation function:
  const { regular, warped } = getGrids(extendedSamples, { stripsPerSide: 3 });

  // Improve the warped grid, to get it less discontinuous:
  const betterWarped = straightenGrid(warped, steps, { force: 0.8, iterations: 5 });

  // Index the grids:
  const regularIndex = getGridIndex(regular);
  const warpedQuadTree = getQuadTree(betterWarped, 4);

  // Return projection function and exact warped grid boundaries:
  const zone = pointsGridToZone(featureToPointsGrid(betterWarped, steps));
  const projection = (position: Position) =>
    projectBetweenGrids(warpedQuadTree, regularIndex, position);

  // Finally we have a proper transformation function that takes any feature
  // as input, clips it to the grid contour polygon, and projects it the
  // regular grid:
  return {
    regularBBox: bbox(regular) as BBox2d,
    transform: <T extends Geometry | Feature | FeatureCollection>(f: T): T | null =>
      clipAndProjectGeoJSON(f, projection, zone),
  };
}
