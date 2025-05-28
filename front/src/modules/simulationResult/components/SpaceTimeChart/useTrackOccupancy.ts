import { useCallback, useEffect, useMemo, useState } from 'react';

import type { OccupancyZone, Track } from '@osrd-project/ui-charts';
import { flatMap, forEach, isFunction, keyBy, keys, pick } from 'lodash';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { extractEditoastIdFromTrainId } from 'utils/trainId';

import type { PathOperationalPoint, TrainSpaceTimeData } from '../../types';
import { batchFetchTrackOccupancy } from './helpers/utils';
import {
  getMovableOccupancyZone,
  getTracksFromZones,
  type MovableOccupancyZone,
} from './helpers/zones';

type AsyncState<T> = { type: 'loading'; data?: T; abort?: () => void } | { type: 'ok'; data: T };
type TracksState = AsyncState<Track[]>;
type ZonesState = AsyncState<MovableOccupancyZone[]>;
type OperationalPointState = { selected: boolean; tracks: TracksState; zones: ZonesState };

type DeployedWaypoint = {
  waypointId: string;
  operationalPointId: string;
  operationalPointPosition: number;
  operationalPointName?: string;
  zones?: OccupancyZone[];
  tracks?: Track[];
};

/**
 * This hook handles track occupancy zones lifecycle.
 *
 * It takes the following inputs:
 * - infraId
 * - trains:
 *   An array with all visible TrainSpaceTimeData items in the SpaceTimeChart
 * - pathOperationalPoints:
 *   An array with all PathOperationalPoint items along the current path
 *
 * It outputs:
 * - deployedWaypoints:
 *   An array with all waypoints that have their track occupancy deployed, with their zones, their
 *   tracks, and other useful metadata
 * - toggleWaypoint:
 *   A function to call to deploy / undeploy a specified waypoint
 */
const useTrackOccupancy = ({
  infraId,
  trains,
  pathOperationalPoints,
}: {
  infraId: number;
  trains: TrainSpaceTimeData[];
  pathOperationalPoints: PathOperationalPoint[];
}): {
  deployedWaypoints: DeployedWaypoint[];
  toggleWaypoint: (waypointId: string, selectedState?: boolean) => void;
} => {
  const pathOperationalPointsDict = useMemo(
    () => keyBy(pathOperationalPoints, 'waypointId'),
    [pathOperationalPoints]
  );
  const [postTrainScheduleTrackOccupancy] =
    osrdEditoastApi.endpoints.postTrainScheduleTrackOccupancy.useMutation();
  const trainsDict = useMemo(
    () => keyBy(trains, ({ id }) => extractEditoastIdFromTrainId(id)),
    [trains]
  );

  const [pathOperationalPointsState, setPathOperationalPointsState] = useState<
    Record<string, OperationalPointState>
  >({});
  const updatePathOperationalPointState = useCallback(
    (
      waypointId: string,
      valueOrReducer:
        | OperationalPointState
        | undefined
        | ((currentState: OperationalPointState | undefined) => OperationalPointState | undefined)
    ) => {
      setPathOperationalPointsState((state) => {
        const res: typeof state = {};

        // Fill other waypoints' data:
        for (const id in state) if (id !== waypointId) res[id] = state[id];

        // Update or create waypoint data, if not nil:
        const newState = isFunction(valueOrReducer)
          ? valueOrReducer(state[waypointId])
          : valueOrReducer;
        if (newState) res[waypointId] = newState;

        return res;
      });
    },
    []
  );

  const fetchTrackOccupancy = useCallback(
    async (
      opId: string | undefined | null,
      trainsCollection: Record<string, TrainSpaceTimeData>
    ) =>
      opId
        ? flatMap(
            (
              await postTrainScheduleTrackOccupancy({
                body: {
                  op_id: opId,
                  infra_id: infraId,
                  train_schedule_ids: Object.keys(trainsCollection).map((id) => +id),
                },
              })
            ).data,
            (entries, trackId) =>
              entries.map((entry) =>
                getMovableOccupancyZone(trackId, entry, trainsCollection[entry.train_schedule_id])
              )
          )
        : [],
    [infraId]
  );

  const deployedWaypoints = useMemo(() => {
    const res: DeployedWaypoint[] = [];

    forEach(pathOperationalPointsState, (opState, waypointId) => {
      const op = pathOperationalPointsDict[waypointId];
      if (opState.selected && typeof op.opId === 'string') {
        res.push({
          waypointId,
          operationalPointId: op.opId,
          operationalPointPosition: op.position,
          operationalPointName: op.extensions?.identifier?.name || undefined,
          zones: opState.zones.data,
          tracks: opState.tracks.data,
        });
      }
    });

    return res;
  }, [pathOperationalPointsState, pathOperationalPointsDict]);

  const toggleWaypoint = useCallback(
    (waypointId: string, selectedState?: boolean) => {
      if (!pathOperationalPointsDict[waypointId])
        throw new Error(`Waypoint ${waypointId} has not been provided to useTrackOccupancy.`);

      const currentState = pathOperationalPointsState[waypointId];
      const currentSelected = !!currentState?.selected;
      const newSelected = typeof selectedState === 'boolean' ? selectedState : !currentSelected;
      if (currentSelected === newSelected) return;

      // Start fetching data:
      if (!currentState) {
        const abort = batchFetchTrackOccupancy(
          keys(trainsDict),
          (ids) =>
            fetchTrackOccupancy(pathOperationalPointsDict[waypointId]?.opId, pick(trainsDict, ids)),
          {
            batchSize: 50,
            onProgress: (data) =>
              updatePathOperationalPointState(waypointId, (state) =>
                state
                  ? {
                      ...state,
                      zones: {
                        ...state.zones,
                        data,
                      },
                      // TODO:
                      // Replace this with a proper call to the upcoming new /infra/{id}/match_operational_points/ endpoint:
                      tracks: {
                        ...state.tracks,
                        data: getTracksFromZones(data),
                      },
                    }
                  : undefined
              ),
            onComplete: (data) => {
              updatePathOperationalPointState(waypointId, (state) =>
                state
                  ? {
                      ...state,
                      zones: {
                        type: 'ok',
                        data,
                      },
                      // TODO:
                      // Replace this with a proper call to the upcoming new /infra/{id}/match_operational_points/ endpoint:
                      tracks: {
                        type: 'ok',
                        data: getTracksFromZones(data),
                      },
                    }
                  : undefined
              );
            },
          }
        );

        updatePathOperationalPointState(waypointId, {
          tracks: { type: 'loading' },
          zones: { type: 'loading', abort },
          selected: newSelected,
        });
      }
      // Else, just toggle the "selected" flag:
      else {
        updatePathOperationalPointState(waypointId, {
          ...currentState,
          selected: newSelected,
        });
      }
    },
    [
      pathOperationalPointsDict,
      pathOperationalPointsState,
      updatePathOperationalPointState,
      trainsDict,
    ]
  );

  // Abort all batch calls on unmount:
  // (the eslint rule is disabled for readability)
  // eslint-disable-next-line
  useEffect(() => {
    return () => {
      forEach(pathOperationalPointsState, ({ zones, tracks }) =>
        [zones, tracks].forEach((asyncState) => {
          if (asyncState.type === 'loading' && asyncState.abort) asyncState.abort();
        })
      );
    };
  }, []);

  return { deployedWaypoints, toggleWaypoint };
};

export default useTrackOccupancy;
