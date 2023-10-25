/* eslint-disable no-console */
import { useDispatch, useSelector } from 'react-redux';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { clamp, first, isEmpty, isNil, keyBy, last, mapValues, omitBy } from 'lodash';
import { PiLinkBold, PiLinkBreakBold } from 'react-icons/pi';

import bbox from '@turf/bbox';
import length from '@turf/length';
import { lineString } from '@turf/helpers';
import { BBox2d } from '@turf/helpers/dist/js/lib/geojson';
import { Feature, FeatureCollection, LineString, Position } from 'geojson';
import { LngLatBoundsLike } from 'maplibre-gl';

import { LoaderFill } from 'common/Loader';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { LayerType } from 'applications/editor/tools/types';
import DataLoader from 'common/Map/WarpedMap/DataLoader';
import getWarping, { WarpingFunction } from 'common/Map/WarpedMap/getWarping';
import WarpedMap from 'common/Map/WarpedMap/WarpedMap';
import { TrainPosition } from 'modules/simulationResult/components/SimulationResultsMap/types';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { getImprovedOSRDData } from 'common/Map/WarpedMap/core/helpers';
import {
  getOsrdSimulation,
  getSelectedProjection,
  getSelectedTrain,
} from 'reducers/osrdsimulation/selectors';
import { Train } from 'reducers/osrdsimulation/types';
import { AsyncMemoState, getAsyncMemoData, useAsyncMemo } from 'utils/useAsyncMemo';
import { getSimulationHoverPositions } from 'modules/simulationResult/components/SimulationResultsMap/helpers';
import { clip } from 'utils/mapHelper';

import './SimulationWarpedMap.scss';

const TIME_LABEL = 'Warping OSRD and OSM data';
const WIDTH = 300;

interface PathStatePayload {
  path: Feature<LineString>;
  pathBBox: BBox2d;
  warpedBBox: BBox2d;
  transform: WarpingFunction;
}

interface DataStatePayload {
  osm: Record<string, FeatureCollection>;
  osrd: Partial<Record<LayerType, FeatureCollection>>;
}

function transformDataStatePayload(
  data: Record<string, FeatureCollection>,
  transform: WarpingFunction
) {
  return omitBy(
    mapValues(data, (collection) => (collection ? transform(collection) : null)),
    isNil
  );
}

/**
 * This component handles loading the simulation path, all the surrounding data (OSM and OSRD), transforms them, and
 * then mounts a WarpedMap with all that data:
 */
const SimulationWarpedMap: FC<{ collapsed?: boolean }> = ({ collapsed }) => {
  const dispatch = useDispatch();
  const infraID = useSelector(getInfraID);
  const [state, setState] = useState<
    | { type: 'idle' }
    | { type: 'loading' }
    | { type: 'error'; message?: string }
    | ({
        type: 'pathLoaded';
      } & PathStatePayload)
    | ({
        type: 'dataLoaded';
      } & PathStatePayload &
        DataStatePayload)
  >({ type: 'idle' });
  const pathfindingID = useSelector(getSelectedProjection)?.path as number;
  const [getPath] = osrdEditoastApi.endpoints.getPathfindingById.useLazyQuery();
  const layers = useMemo(() => new Set<LayerType>(['track_sections']), []);
  const [mode, setMode] = useState<'manual' | 'auto'>('auto');
  const {
    chart,
    positionValues,
    timePosition,
    allowancesSettings,
    simulation: { present: simulation },
  } = useSelector(getOsrdSimulation);

  // Boundaries handling (ie zoom sync):
  const syncedBoundingBox: LngLatBoundsLike = useMemo(() => {
    if (chart && state.type === 'dataLoaded') {
      const { x, y, width, height, rotate } = chart;
      const { path, transform, warpedBBox } = state;
      const l = length(path, { units: 'meters' });

      const chartStart = !rotate ? y(0) : x(0);
      const chartEnd = !rotate ? y(l) : x(l);
      const size = !rotate ? height : width;

      const transformedPath = transform(path) as typeof path;
      const latStart = (first(transformedPath.geometry.coordinates) as Position)[1];
      const latEnd = (last(transformedPath.geometry.coordinates) as Position)[1];

      /*
       * Here, `y` is the function provided by d3 to scale distance in meters from the beginning of the path to pixels
       * from the bottom of the `SpaceTimeChart` (going upwards) to the related point (we use `x` instead when the chart
       * is rotated).
       * So, `chartStart` is the y coordinate of the start of the path at the current zoom level, and chartEnd is the y
       * coordinate of the end of the path.
       * Finally, `size` is the height in pixels of the SpaceTimeChart (or width when the chart is rotated).
       *
       * Also, we know `latStart` and `latEnd`, which are the latitudes of the first and the last points of our
       * transformed path.
       *
       * We are looking for `latBottom` and `latTop` so that our warped map is as much "aligned" as we can with the
       * `SpaceTimeChart`. According to Thalès, we know that:
       *
       *   (latStart - latBottom) / chartStart
       * = (latTop - latBottom) / size
       * = (latEnd - latStart) / (chartEnd - chartStart)
       *
       * That explains the following computations:
       */
      const ratio = (latEnd - latStart) / (chartEnd - chartStart);
      const latBottom = clamp(latStart - chartStart * ratio, -90, 90);
      const latTop = clamp(latBottom + size * ratio, -90, 90);

      // Since we are here describing a bounding box where only the latBottom and latTop are important, it will have a
      // 0 width, and we just need to specify the middle longitude (based on the visible part of the path on the screen,
      // so depending on the latTop and latBottom values):
      const clippedPath = clip(transformedPath, {
        type: 'rectangle',
        points: [
          [warpedBBox[0], latTop],
          [warpedBBox[2], latBottom],
        ],
      }) as typeof transformedPath;
      const clippedPathBBox = bbox(clippedPath) as BBox2d;
      const lngAverage = (clippedPathBBox[0] + clippedPathBBox[2]) / 2;

      return [
        [lngAverage, latTop],
        [lngAverage, latBottom],
      ] as LngLatBoundsLike;
    }

    if (state.type === 'dataLoaded' || state.type === 'pathLoaded') {
      const { warpedBBox } = state;
      const lngAverage = (warpedBBox[0] + warpedBBox[2]) / 2;

      return [
        [lngAverage, warpedBBox[1]],
        [lngAverage, warpedBBox[3]],
      ];
    }

    // This should never occur:
    return [
      [0, 0],
      [0, 0],
    ] as LngLatBoundsLike;
  }, [chart, state]);

  // Itinerary handling:
  const selectedTrain = useSelector(getSelectedTrain);
  const itineraryState: AsyncMemoState<Feature<LineString> | null> = useAsyncMemo(async () => {
    if (!selectedTrain || state.type !== 'dataLoaded') return null;

    const { data: path } = await getPath({ id: selectedTrain.path });
    if (!path) return null;

    return lineString(path.geographic.coordinates);
  }, [selectedTrain, state.type, simulation]);
  const warpedItinerary = useMemo(() => {
    const itinerary = getAsyncMemoData(itineraryState);
    if (itinerary && state.type === 'dataLoaded') return state.transform(itinerary) || undefined;
    return undefined;
  }, [itineraryState, state]);

  // Trains handling:
  // TODO: remove the cast to Train
  const trainsIndex = useMemo(() => keyBy(simulation.trains as Train[], 'id'), [simulation.trains]);
  const trainsPositionsState: AsyncMemoState<
    (TrainPosition & { train: Train; isSelected?: boolean })[]
  > = useAsyncMemo(async () => {
    const path = getAsyncMemoData(itineraryState);
    if (!path || !warpedItinerary || state.type !== 'dataLoaded') return [];

    const pathLength = length(path);
    const transformedPathLength = length(warpedItinerary);

    return getSimulationHoverPositions(
      path,
      simulation,
      timePosition,
      positionValues,
      selectedTrain?.id,
      allowancesSettings
    ).map((position) => {
      const transformedTrain = { ...position };

      // Transform positions:
      transformedTrain.headPosition = state.transform(
        position.headPosition
      ) as TrainPosition['headPosition'];
      transformedTrain.tailPosition = state.transform(
        position.tailPosition
      ) as TrainPosition['tailPosition'];

      // Interpolate positions:
      transformedTrain.headDistanceAlong =
        (position.headDistanceAlong / pathLength) * transformedPathLength;
      transformedTrain.tailDistanceAlong =
        (position.tailDistanceAlong / pathLength) * transformedPathLength;

      return { ...transformedTrain, train: trainsIndex[position.trainId] };
    });
  }, [
    itineraryState,
    simulation,
    timePosition,
    positionValues,
    selectedTrain,
    allowancesSettings,
    state,
  ]);

  /**
   * This effect handles loading the simulation path, and retrieve the warping function:
   */
  useEffect(() => {
    setState({ type: 'loading' });
    getPath({ id: pathfindingID })
      .then(({ data, isError, error }) => {
        if (isError) {
          setState({ type: 'error', message: error as string });
        } else if (!data?.geographic?.coordinates) {
          setState({ type: 'error', message: 'No coordinates' });
        } else {
          const path = lineString(data?.geographic?.coordinates as Position[]);
          const pathBBox = bbox(path) as BBox2d;
          const { warpedBBox, transform } = getWarping(path);

          setState({ type: 'pathLoaded', path, pathBBox, warpedBBox, transform });
        }
      })
      .catch((error) => setState({ type: 'error', message: error }));
  }, [pathfindingID]);

  /**
   * This effect tries to gradually improve the quality of the OSRD data.
   * Initially, all OSRD entities are with "simplified" geometries, due to the
   * fact that they are loaded directly using an unzoomed map.
   */
  useEffect(() => {
    if (state.type !== 'dataLoaded') return;

    getImprovedOSRDData(infraID as number, state.osrd, dispatch).then((betterFeatures) => {
      if (!isEmpty(betterFeatures)) {
        const betterTransformedFeatures = mapValues(betterFeatures, state.transform);
        const newTransformedOSRDData = mapValues(state.osrd, (collection: FeatureCollection) => ({
          ...collection,
          features: collection.features.map(
            (feature) => betterTransformedFeatures[feature.properties?.id] || feature
          ),
        }));
        setState({ ...state, osrd: newTransformedOSRDData });
      }
    });
    // We call the function only if the state's type change otherwise we go to an infinite loop
  }, [state.type]);

  return (
    <div
      className="warped-map position-relative d-flex flex-row"
      style={{ width: collapsed ? 0 : WIDTH }}
    >
      {state.type === 'pathLoaded' && (
        <DataLoader
          bbox={state.pathBBox}
          layers={layers}
          getGeoJSONs={(osrdData, osmData) => {
            console.time(TIME_LABEL);
            const transformed = {
              osm: transformDataStatePayload(osmData, state.transform) as DataStatePayload['osm'],
              osrd: transformDataStatePayload(
                osrdData,
                state.transform
              ) as DataStatePayload['osrd'],
            };
            console.timeEnd(TIME_LABEL);
            setState({ ...state, ...transformed, type: 'dataLoaded' });
          }}
        />
      )}
      {state.type !== 'dataLoaded' && <LoaderFill />}
      {state.type === 'dataLoaded' && (
        <div
          className="bg-white border m-3"
          style={{
            width: WIDTH,
            borderRadius: 4,
            marginRight: '0.5rem',
          }}
        >
          <WarpedMap
            osrdLayers={layers}
            bbox={state.warpedBBox}
            osrdData={state.osrd}
            osmData={state.osm}
            itinerary={warpedItinerary}
            trainsPositions={getAsyncMemoData(trainsPositionsState) || undefined}
            boundingBox={mode === 'auto' ? syncedBoundingBox : undefined}
            allowancesSettings={allowancesSettings}
          />
          <div className="buttons">
            <button
              type="button"
              className="btn-rounded btn-rounded-white box-shadow btn-rotate"
              onClick={() => setMode(mode === 'auto' ? 'manual' : 'auto')}
            >
              {mode === 'manual' ? <PiLinkBold /> : <PiLinkBreakBold />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationWarpedMap;
