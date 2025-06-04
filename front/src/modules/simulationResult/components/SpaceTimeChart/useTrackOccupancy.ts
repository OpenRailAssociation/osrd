import { useCallback, useEffect, useMemo, useState } from 'react';

import type { OccupancyZone, Track } from '@osrd-project/ui-charts';
import { flatMap, forEach, fromPairs, isFunction, keyBy, keys, noop, pick, uniqBy } from 'lodash';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TrainId } from 'reducers/osrdconf/types';
import { extractEditoastIdFromTrainId } from 'utils/trainId';

import type { PathOperationalPoint, TrainSpaceTimeData } from '../../types';
import { batchFetchTrackOccupancy } from './helpers/utils';
import { getMovableOccupancyZone, type MovableOccupancyZone } from './helpers/zones';

type AsyncState<T> = { type: 'loading'; data?: T; abort?: () => void } | { type: 'ok'; data: T };
type ZonesState = AsyncState<MovableOccupancyZone[]>;
type OperationalPointState = { selected: boolean; zones: ZonesState };

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
 * - handleTrainDrag:
 *   A function to call when a train is dragged in the SpaceTimeChart, so that its related
 *   occupancy zones are updated accordingly
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
  handleTrainDrag: ({
    draggedTrainId,
    newTrainData,
    initialDepartureTime,
    stopPanning,
  }: {
    draggedTrainId: TrainId;
    initialDepartureTime: Date;
    newTrainData: TrainSpaceTimeData;
    stopPanning: boolean;
  }) => Promise<void>;
} => {
  const pathOperationalPointsDict = useMemo(
    () => keyBy(pathOperationalPoints, 'waypointId'),
    [pathOperationalPoints]
  );
  const [postTrainScheduleTrackOccupancy] =
    osrdEditoastApi.endpoints.postTrainScheduleTrackOccupancy.useMutation();
  const [postInfraByInfraIdMatchOperationalPoints] =
    osrdEditoastApi.endpoints.postInfraByInfraIdMatchOperationalPoints.useMutation();
  const trainsDict = useMemo(
    () => keyBy(trains, ({ id }) => extractEditoastIdFromTrainId(id)),
    [trains]
  );

  const [tracksState, setTracksState] = useState<AsyncState<Record<string, Track[]>>>({
    type: 'loading',
  });
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
                  operational_point_id: opId,
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

    if (tracksState.type === 'ok')
      forEach(pathOperationalPointsState, (opState, waypointId) => {
        const op = pathOperationalPointsDict[waypointId];
        if (opState.selected && typeof op?.opId === 'string') {
          const tracks = tracksState.data[op.opId];
          res.push({
            waypointId,
            operationalPointId: op.opId,
            operationalPointPosition: op.position,
            operationalPointName: op.extensions?.identifier?.name || undefined,
            zones: opState.zones.data,
            tracks,
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
                    }
                  : undefined
              );
            },
          }
        );

        updatePathOperationalPointState(waypointId, {
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

  const handleTrainDrag = useCallback(
    async ({
      draggedTrainId,
      newTrainData,
      initialDepartureTime,
      stopPanning,
    }: {
      draggedTrainId: TrainId;
      initialDepartureTime: Date;
      newTrainData: TrainSpaceTimeData;
      stopPanning: boolean;
    }) => {
      // Update actual state:
      const impactedPathOperationalPointIDs = new Set<string>();
      const newState = { ...pathOperationalPointsState };
      forEach(newState, (opState, waypointId) => {
        if (opState.selected) {
          forEach(opState.zones.data, (zone) => {
            if (zone.trainId === draggedTrainId) {
              impactedPathOperationalPointIDs.add(waypointId);
              const offset = newTrainData.departureTime.getTime() - initialDepartureTime.getTime();
              zone.startTime = zone.dbStartTime + offset;
              zone.endTime = zone.dbEndTime + offset;
            }
          });
        }
      });
      setPathOperationalPointsState(newState);

      // Fetch new occupation if dragging has stopped:
      if (stopPanning) {
        const draggedTrainEditoastId = extractEditoastIdFromTrainId(draggedTrainId);
        await Promise.all(
          [...impactedPathOperationalPointIDs].map(async (waypointId) => {
            const newZones = await fetchTrackOccupancy(
              pathOperationalPointsDict[waypointId]?.opId,
              { [draggedTrainEditoastId]: newTrainData }
            );

            if (newZones.length)
              setPathOperationalPointsState((state) => {
                const opState = state[waypointId];
                opState.zones.data = opState.zones.data?.map((zone) =>
                  zone.trainId === draggedTrainId ? newZones[0] : zone
                );
                return state;
              });
          })
        );
      }
    },
    [pathOperationalPointsDict, pathOperationalPointsState]
  );

  // Abort all batch calls on unmount:
  // (the eslint rule is disabled for readability)
  // eslint-disable-next-line
  useEffect(() => {
    return () => {
      forEach(pathOperationalPointsState, ({ zones }) => {
        if (zones.type === 'loading' && zones.abort) zones.abort();
      });
    };
  }, []);

  // Load all tracks from all waypoints on mount / waypoints update:
  useEffect(() => {
    let aborted = false;

    const pathOperationalPointsWithoutTracks = pathOperationalPoints.filter(
      (op) => !(tracksState.data || {})[op.waypointId]
    );
    const loadAllTracks = async (
      operationalPointReferences: {
        operational_point: string;
      }[]
    ) => {
      setTracksState((state) => ({ type: 'loading', data: state.data || {} }));

      try {
        const { data, error } = await postInfraByInfraIdMatchOperationalPoints({
          infraId,
          body: {
            operational_point_references: operationalPointReferences,
          },
        });

        if (aborted) return;
        if (error) throw new Error('Error while fetching tracks definition', { cause: error });

        setTracksState({
          type: 'ok',
          data: fromPairs(
            operationalPointReferences.map(({ operational_point }, i) => [
              operational_point,
              uniqBy(
                data.related_operational_points[i][0].parts.map((part) => ({
                  id: part.track,
                  name: data.track_names[part.track] || undefined,
                  line: undefined,
                })),
                (track) => track.id
              ),
            ])
          ),
        });
      } catch (e) {
        console.error(e);
      }
    };
    const waypointsPayload = pathOperationalPointsWithoutTracks.flatMap((op) =>
      op.opId ? [{ operational_point: op.opId }] : []
    );
    if (!waypointsPayload.length) return noop;

    loadAllTracks(waypointsPayload);
    return () => {
      aborted = true;
    };
  }, [pathOperationalPoints]);

  return { deployedWaypoints, toggleWaypoint, handleTrainDrag };
};

export default useTrackOccupancy;
