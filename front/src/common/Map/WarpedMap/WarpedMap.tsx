/* eslint-disable no-console */
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { isNil, mapValues, omitBy } from 'lodash';

import bbox from '@turf/bbox';
import simplify from '@turf/simplify';
import { lineString } from '@turf/helpers';
import { BBox2d } from '@turf/helpers/dist/js/lib/geojson';
import { Feature, FeatureCollection, Geometry, LineString, Position } from 'geojson';

import {
  extendLine,
  featureToPointsGrid,
  getGridIndex,
  getSamples,
  pointsGridToZone,
} from './core/helpers';
import { getQuadTree } from './core/quadtree';
import { getGrids, straightenGrid } from './core/grids';
import { clipAndProjectGeoJSON, projectBetweenGrids } from './core/projection';
import { RootState } from '../../../reducers';
import { LoaderFill } from '../../Loader';
import { osrdEditoastApi } from '../../api/osrdEditoastApi';
import { LayerType } from '../../../applications/editor/tools/types';
import DataLoader from './DataLoader';
import DataDisplay from './DataDisplay';

type TransformedData = {
  osm: Record<string, FeatureCollection>;
  osrd: Partial<Record<LayerType, FeatureCollection>>;
};

const TIME_LABEL = 'Warping OSRD and OSM data';

export const PathWarpedMap: FC<{ path: Feature<LineString> }> = ({ path }) => {
  const layers = useMemo(() => new Set<LayerType>(['track_sections']), []);
  const [transformedData, setTransformedData] = useState<TransformedData | null>(null);
  const pathBBox = useMemo(() => bbox(path) as BBox2d, [path]);

  // Transformation function:
  const { regularBBox, transform } = useMemo(() => {
    // Simplify the input path to get something "straighter", so that we can see
    // in the final warped map the small curves of the initial path:
    const simplifiedPath = simplify(path, { tolerance: 0.01 });

    // Cut the simplified path as N equal length segments
    const sample = getSamples(simplifiedPath, 15);
    const samplePath = lineString(sample.points.map((point) => point.geometry.coordinates));

    // Extend the sample, so that we can warp things right before and right
    // after the initial path:
    const extendedSamples = extendLine(samplePath, sample.step);
    const steps = extendedSamples.geometry.coordinates.length - 1;

    // Generate our base grids:
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
  }, [path]);

  return (
    <div className="warped-map position-relative d-flex flex-row">
      <DataLoader
        bbox={pathBBox}
        layers={layers}
        getGeoJSONs={(osrdData, osmData) => {
          console.time(TIME_LABEL);
          const transformed = {
            osm: omitBy(
              mapValues(osmData, (collection) => transform(collection)),
              isNil
            ),
            osrd: omitBy(
              mapValues(osrdData, (collection: FeatureCollection) => transform(collection)),
              isNil
            ),
          } as TransformedData;
          console.timeEnd(TIME_LABEL);
          setTransformedData(transformed);
        }}
      />
      <div
        className="bg-white"
        style={{
          width: 200,
          height: '100%',
          padding: '1rem',
          borderRadius: 4,
          marginRight: '0.5rem',
        }}
      >
        <DataDisplay
          osrdLayers={layers}
          bbox={regularBBox}
          osrdData={transformedData?.osrd}
          osmData={transformedData?.osm}
        />
      </div>
    </div>
  );
};

export const WarpedMap: FC = () => {
  const [state, setState] = useState<
    | { type: 'idle' }
    | { type: 'loading' }
    | { type: 'ready'; path: Feature<LineString> }
    | { type: 'error'; message?: string }
  >({ type: 'idle' });
  const pathfindingID = useSelector(
    (s: RootState) => s.osrdsimulation.selectedProjection?.path
  ) as number;
  const [getPath] = osrdEditoastApi.useLazyGetPathfindingByIdQuery();

  useEffect(() => {
    setState({ type: 'loading' });
    getPath({ id: pathfindingID })
      .then(({ data, isError, error }) => {
        if (isError) {
          setState({ type: 'error', message: error as string });
        } else {
          const coordinates = data?.geographic?.coordinates as Position[] | null;

          setState(
            coordinates
              ? { type: 'ready', path: lineString(coordinates) }
              : { type: 'error', message: 'No coordinates' }
          );
        }
      })
      .catch((error) => setState({ type: 'error', message: error }));
  }, [pathfindingID]);

  return state.type === 'ready' ? <PathWarpedMap path={state.path} /> : <LoaderFill />;
};
