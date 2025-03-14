import { bbox } from '@turf/bbox';
import { lineString } from '@turf/helpers';
import { simplify } from '@turf/simplify';
import type { Feature, FeatureCollection, Geometry, LineString, Position } from 'geojson';

import {
  featureToPointsGrid,
  getGridIndex,
  getGrids,
  pointsGridToZone,
  straightenGrid,
} from './grids';
import { bboxAs2D, extendLine, getSamples } from './helpers';
import { clipAndProjectGeoJSON, projectBetweenGrids } from './projection';
import { getQuadTree } from './quadtree';

export type WarpingFunction = ReturnType<typeof getWarping>['transform'];

export type WarpingOptions = {
  tolerance: number;
  samplesCount: number;
  straightenForce: number;
  straightenIterations: number;
  quadtreeDepth: number;
  stripsPerSide: number;
};

export const DEFAULT_WARPING_OPTIONS: WarpingOptions = {
  tolerance: 0.01,
  samplesCount: 15,
  straightenForce: 0.8,
  straightenIterations: 5,
  quadtreeDepth: 4,
  stripsPerSide: 3,
};

export default function getWarping(
  warpPath: Feature<LineString>,
  options: Partial<WarpingOptions> = {}
) {
  const opts: WarpingOptions = {
    ...DEFAULT_WARPING_OPTIONS,
    ...options,
  };

  // Simplify the input path to get something "straighter", so that we can see
  // in the final warped map the small curves of the initial path.
  // (Indeed, if we don't simplify the path, then in the final map the path will
  // appear as perfectly straight line, which makes it less identifiable)
  // TODO: Detect loops and remove them from the simplifiedPath
  const simplifiedPath = simplify(warpPath, { tolerance: opts.tolerance });

  // Cut the simplified path as N equal length segments
  const sample = getSamples(simplifiedPath, opts.samplesCount);
  const samplePath = lineString(sample.points.map((point) => point.geometry.coordinates));

  // Extend the sample, so that we can warp things right before and right
  // after the initial path:
  const extendedSamples = extendLine(samplePath, sample.step);
  const stepsCount = extendedSamples.geometry.coordinates.length - 1;

  // Generate our base grids, so that we can start shaping our transformation function:
  const { warped, original } = getGrids(extendedSamples, { stripsPerSize: opts.stripsPerSide });

  // Improve the warped grid, to get it less discontinuous:
  const betterOriginal = straightenGrid(original, stepsCount, {
    force: opts.straightenForce,
    iterations: opts.straightenIterations,
  });

  // Index the grids:
  const warpedIndex = getGridIndex(warped);
  const originalQuadTree = getQuadTree(betterOriginal, opts.quadtreeDepth);

  // Return projection function and exact warped grid boundaries:
  const zone = pointsGridToZone(featureToPointsGrid(betterOriginal, stepsCount));
  const projection = (position: Position) =>
    projectBetweenGrids(originalQuadTree, warpedIndex, position);

  // Finally we have a proper transformation function that takes any feature
  // as input, clips it to the grid contour polygon, and projects it the
  // regular grid:
  return {
    warpedPathBBox: bboxAs2D(bbox(warped)),
    transform: <T extends Geometry | Feature | FeatureCollection>(f: T): T | null =>
      clipAndProjectGeoJSON(f, projection, zone),

    // For testing and demoing purpose only:
    grid: betterOriginal,
    warpedGrid: warped,
  };
}
