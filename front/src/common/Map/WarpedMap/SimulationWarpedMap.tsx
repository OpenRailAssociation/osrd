/* eslint-disable no-console */
import { useSelector } from 'react-redux';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { isEmpty, isNil, mapValues, omitBy } from 'lodash';

import bbox from '@turf/bbox';
import { lineString } from '@turf/helpers';
import { BBox2d } from '@turf/helpers/dist/js/lib/geojson';
import { Feature, FeatureCollection, LineString, Position } from 'geojson';

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

const TIME_LABEL = 'Warping OSRD and OSM data';

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

function useAsyncMemo<T, D = undefined>(fn: () => Promise<T>, defaultValue: D): T | D {
  const [v, setV] = useState<T | D>(defaultValue);

  useEffect(() => {
    fn().then(setV);
  }, [fn]);

  return v;
}

/**
 * This component handles loading the simulation path, all the surrounding data (OSM and OSRD), transforms them, and
 * then mounts a WarpedMap with all that data:
 */
const SimulationWarpedMap: FC = () => {
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

  // Itinerary handling:
  const simulation = useSelector(
    (rootState: RootState) => rootState.osrdsimulation.simulation.present
  );
  const selectedTrain = useSelector(getSelectedTrain);
  const getItinerary = useCallback(async () => {
    if (!selectedTrain) return undefined;
    if (state.type !== 'dataLoaded') return undefined;

    const foundTrain = simulation.trains.find((train) => train.id === selectedTrain.id);
    if (!foundTrain) return undefined;

    const { data: path } = await getPath({ id: foundTrain.path });
    if (!path) return undefined;

    return state.transform(lineString(path.geographic.coordinates)) || undefined;
  }, []);
  const itinerary: Feature<LineString> | undefined = useAsyncMemo(getItinerary, undefined);

  // Trains handling:
  const getTrains = useCallback(
    async () =>
      // TODO
      [],
    []
  );
  const trains: (TrainPosition & { isSelected?: true })[] = useAsyncMemo(getTrains, []);

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

  if (state.type === 'idle' || state.type === 'loading' || state.type === 'error')
    return <LoaderFill />;

  if (state.type === 'pathLoaded')
    return (
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
    );

  return (
    <div className="warped-map position-relative d-flex flex-row">
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
        <WarpedMap
          osrdLayers={layers}
          bbox={state.regularBBox}
          osrdData={state.osrd}
          osmData={state.osm}
          itinerary={itinerary}
          trains={trains}
        />
      </div>
    </div>
  );
};

export default SimulationWarpedMap;
