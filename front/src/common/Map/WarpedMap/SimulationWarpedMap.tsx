/* eslint-disable no-console */
import { useSelector } from 'react-redux';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { clamp, first, isEmpty, isNil, keyBy, last, mapValues, omitBy } from 'lodash';
import { PiLinkBold, PiLinkBreakBold } from 'react-icons/pi';

import bbox from '@turf/bbox';
import length from '@turf/length';
import { lineString } from '@turf/helpers';
import { BBox2d } from '@turf/helpers/dist/js/lib/geojson';
import { Feature, FeatureCollection, LineString, Position } from 'geojson';
import { LngLatBoundsLike } from 'maplibre-gl';

import { RootState } from 'reducers';
import { LoaderFill } from 'common/Loader';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { LayerType } from 'applications/editor/tools/types';
import DataLoader from 'common/Map/WarpedMap/DataLoader';
import getWarping, { WarpingFunction } from 'common/Map/WarpedMap/getWarping';
import WarpedMap from 'common/Map/WarpedMap/WarpedMap';
import { TrainPosition } from 'applications/operationalStudies/components/SimulationResults/SimulationResultsMap/types';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { getImprovedOSRDData } from 'common/Map/WarpedMap/core/helpers';
import { getSelectedTrain } from 'reducers/osrdsimulation/selectors';
import { AsyncMemoState, getAsyncMemoData, useAsyncMemo } from 'utils/useAsyncMemo';
import { getSimulationHoverPositions } from 'applications/operationalStudies/components/SimulationResults/SimulationResultsMap/helpers';
import { clip } from 'utils/mapHelper';

import './SimulationWarpedMap.scss';
import { Train } from '../../../reducers/osrdsimulation/types';

const TIME_LABEL = 'Warping OSRD and OSM data';
const WIDTH = 300;

interface PathStatePayload {
  path: Feature<LineString>;
  pathBBox: BBox2d;
  regularBBox: BBox2d;
  transform: WarpingFunction;
}

interface DataStatePayload {
  osm: Record<string, FeatureCollection>;
  osrd: Partial<Record<LayerType, FeatureCollection>>;
}

/**
 * This component handles loading the simulation path, all the surrounding data (OSM and OSRD), transforms them, and
 * then mounts a WarpedMap with all that data:
 */
const SimulationWarpedMap: FC<{ collapsed?: boolean }> = ({ collapsed }) => {
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
  const pathfindingID = useSelector(
    (s: RootState) => s.osrdsimulation.selectedProjection?.path
  ) as number;
  const [getPath] = osrdEditoastApi.useLazyGetPathfindingByIdQuery();
  const layers = useMemo(() => new Set<LayerType>(['track_sections']), []);
  const [mode, setMode] = useState<'manual' | 'auto'>('auto');

  // Boundaries handling (ie zoom sync):
  const chart = useSelector((s: RootState) => s.osrdsimulation.chart);
  const syncedBoundingBox: LngLatBoundsLike = useMemo(() => {
    if (chart && state.type === 'dataLoaded') {
      const { y, height } = chart;
      const { path, transform, regularBBox } = state;
      const l = length(path, { units: 'meters' });

      const yStart = y(0);
      const yEnd = y(l);

      const transformedPath = transform(path) as typeof path;
      const latStart = (first(transformedPath.geometry.coordinates) as Position)[1];
      const latEnd = (last(transformedPath.geometry.coordinates) as Position)[1];

      /**
       * Here, `y` is the function provided by d3 to scale distance in meters from the beginning of the path to pixels
       * from the bottom of the `SpaceTimeChart` (going upwards) to the related point.
       * So, `yStart` is the y coordinate of the start of the path at the current zoom level, and yEnd is the y
       * coordinate of the end of the path.
       * Finally, `height` is the height in pixels of the SpaceTimeChart.
       *
       * Also, we now `latStart` and `latEnd`, which are the latitudes of the first and the last points of our
       * transformed path.
       *
       * We are looking for `latBottom` and `latTop` so that our warped map is as much "aligned" as we can with the
       * `SpaceTimeChart`. According to Thalès, we know that:
       *
       * (latStart - latBottom) / yStart = (latTop - latBottom) / height = (latEnd - latStart) / (yEnd - yStart)
       *
       * That explains the following computations:
       */
      const ratio = (latEnd - latStart) / (yEnd - yStart);
      const latBottom = clamp(latStart - yStart * ratio, -90, 90);
      const latTop = clamp(latBottom + height * ratio, -90, 90);

      // Since we are here describing a bounding box where only the latBottom and latTop are important, it will have a
      // 0 width, and we just need to specify the middle longitude (based on the visible part of the path on the screen,
      // so depending on the latTop and latBottom values):
      const clippedPath = clip(transformedPath, {
        type: 'rectangle',
        points: [
          [regularBBox[0], latTop],
          [regularBBox[2], latBottom],
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
      const { regularBBox } = state;
      const lngAverage = (regularBBox[0] + regularBBox[2]) / 2;

      return [
        [lngAverage, regularBBox[1]],
        [lngAverage, regularBBox[3]],
      ];
    }

    // This should never occur:
    return [
      [0, 0],
      [0, 0],
    ] as LngLatBoundsLike;
  }, [chart, state]);

  // Itinerary handling:
  const {
    positionValues,
    timePosition,
    allowancesSettings,
    simulation: { present: simulation },
  } = useSelector((s: RootState) => s.osrdsimulation);
  const selectedTrain = useSelector(getSelectedTrain);
  const itineraryState: AsyncMemoState<Feature<LineString> | null> = useAsyncMemo(async () => {
    if (!selectedTrain) return null;
    if (state.type !== 'dataLoaded') return null;

    const foundTrain = simulation.trains.find((train) => train.id === selectedTrain.id);
    if (!foundTrain) return null;

    const { data: path } = await getPath({ id: foundTrain.path });
    if (!path) return null;

    return lineString(path.geographic.coordinates);
  }, [selectedTrain, state.type, simulation]);
  const warpedItinerary = useMemo(() => {
    const itinerary = getAsyncMemoData(itineraryState);
    if (itinerary && state.type === 'dataLoaded') return state.transform(itinerary) || undefined;
    return undefined;
  }, [itineraryState, state]);

  // Trains handling:
  const trainsIndex = useMemo(() => keyBy(simulation.trains, 'id'), [simulation.trains]);
  const trainsPositionsState: AsyncMemoState<
    (TrainPosition & { train: Train; isSelected?: boolean })[]
  > = useAsyncMemo(async () => {
    const path = getAsyncMemoData(itineraryState);
    if (!path || state.type !== 'dataLoaded') return [];

    const transformedPath = state.transform(path) as typeof path;
    return getSimulationHoverPositions(
      path,
      simulation,
      timePosition,
      positionValues,
      selectedTrain?.id,
      allowancesSettings
    ).map((position) => {
      const transformedTrain = { ...position };
      const pathLength = length(path);
      const transformedPathLength = length(transformedPath);

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
          const { regularBBox, transform } = getWarping(path);

          setState({ type: 'pathLoaded', path, pathBBox, regularBBox, transform });
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

    getImprovedOSRDData(infraID as number, state.osrd).then((betterFeatures) => {
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
  }, [state]);

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
              osm: omitBy(
                mapValues(osmData, (collection) => state.transform(collection)),
                isNil
              ) as DataStatePayload['osm'],
              osrd: omitBy(
                mapValues(osrdData, (collection: FeatureCollection) => state.transform(collection)),
                isNil
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
            bbox={state.regularBBox}
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
