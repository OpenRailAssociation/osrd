import { useEffect, useMemo, useState } from 'react';

import bbox from '@turf/bbox';
import { lineString } from '@turf/helpers';
import length from '@turf/length';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { clamp, first, isEmpty, isNil, last, mapValues, omitBy } from 'lodash';
import type { LngLatBoundsLike } from 'maplibre-gl';
import { PiLinkBold, PiLinkBreakBold } from 'react-icons/pi';
import { useSelector } from 'react-redux';

import type { Layer } from 'applications/editor/consts';
import { type GeoJsonLineStringValue, type PathProperties } from 'common/api/osrdEditoastApi';
import { LoaderFill } from 'common/Loaders';
import WarpedMap from 'common/Map/WarpedMap';
import { getImprovedOSRDData, type BBox2d } from 'common/Map/WarpedMap/core/helpers';
import DataLoader from 'common/Map/WarpedMap/DataLoader';
import type { WarpingFunction } from 'common/Map/WarpedMap/getWarping';
import getWarping from 'common/Map/WarpedMap/getWarping';
import { useInfraID } from 'common/osrdContext';
import { getSimulationResults } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { clip } from 'utils/mapHelper';

const WIDTH = 300;

type PathStatePayload = {
  path: Feature<LineString>;
  pathBBox: BBox2d;
  warpedBBox: BBox2d;
  transform: WarpingFunction;
};

type DataStatePayload = {
  osm: Record<string, FeatureCollection>;
  osrd: Partial<Record<Layer, FeatureCollection>>;
};

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
const SimulationWarpedMap = ({
  collapsed,
  pathGeometry,
}: {
  collapsed?: boolean;
  pathGeometry?: PathProperties['geometry'];
}) => {
  const dispatch = useAppDispatch();
  const infraID = useInfraID();
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

  const layers = useMemo(() => new Set<Layer>(['track_sections']), []);
  const [mode, setMode] = useState<'manual' | 'auto'>('auto');
  const { chart } = useSelector(getSimulationResults);

  // Boundaries handling (ie zoom sync):
  const syncedBoundingBox: LngLatBoundsLike = useMemo(() => {
    if (chart && state.type === 'dataLoaded') {
      const { x, y, width, height, rotate } = chart;
      const { path, transform, warpedBBox } = state;
      const l = length(path, { units: 'meters' });

      const chartStart = !rotate ? y(0) : x(0);
      const chartEnd = !rotate ? y(l) : x(l);
      const size = !rotate ? height : width;

      // we don't clip the path
      const transformedPath = transform(path, false)!;
      const latStart = first(transformedPath.geometry.coordinates)![1];
      const latEnd = last(transformedPath.geometry.coordinates)![1];

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
      })!;
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

  const itineraryState: Feature<LineString> | null = useMemo(() => {
    if (pathGeometry) return lineString(pathGeometry.coordinates);
    return null;
  }, [pathGeometry]);

  const warpedItinerary = useMemo(() => {
    if (itineraryState && state.type === 'dataLoaded')
      // we don't clip the path
      return state.transform(itineraryState, false) || undefined;
    return undefined;
  }, [itineraryState, state]);

  const updateWarpedMapState = (coordinates: GeoJsonLineStringValue) => {
    const path = lineString(coordinates);
    const pathBBox = bbox(path) as BBox2d;
    const { warpedBBox, transform } = getWarping(path);
    setState({ type: 'pathLoaded', path, pathBBox, warpedBBox, transform });
  };

  /**
   * This effect handles loading the simulation path, and retrieve the warping function:
   */
  useEffect(() => {
    setState({ type: 'loading' });
    if (pathGeometry) updateWarpedMapState(pathGeometry.coordinates);
  }, [pathGeometry]);

  /**
   * This effect tries to gradually improve the quality of the OSRD data.
   * Initially, all OSRD entities are with "simplified" geometries, due to the
   * fact that they are loaded directly using an unzoomed map.
   */
  useEffect(() => {
    if (state.type !== 'dataLoaded') return;

    getImprovedOSRDData(infraID!, state.osrd, dispatch).then((betterFeatures) => {
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
      data-testid="simulation-warped-map"
      className="warped-map position-relative d-flex flex-row"
      style={{ width: collapsed ? 0 : WIDTH }}
    >
      {state.type === 'pathLoaded' && (
        <DataLoader
          bbox={state.pathBBox}
          layers={layers}
          getGeoJSONs={(osrdData, osmData) => {
            const transformed = {
              osm: transformDataStatePayload(osmData, state.transform) as DataStatePayload['osm'],
              osrd: transformDataStatePayload(
                osrdData,
                state.transform
              ) as DataStatePayload['osrd'],
            };
            setState({ ...state, ...transformed, type: 'dataLoaded' });
          }}
        />
      )}
      {state.type !== 'dataLoaded' && <LoaderFill />}
      {state.type === 'dataLoaded' && (
        <div
          className="bg-white border"
          style={{
            width: WIDTH,
            borderRadius: 4,
          }}
        >
          <WarpedMap
            osrdLayers={layers}
            bbox={state.warpedBBox}
            osrdData={state.osrd}
            osmData={state.osm}
            itinerary={warpedItinerary}
            boundingBox={mode === 'auto' ? syncedBoundingBox : undefined}
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
