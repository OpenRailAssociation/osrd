import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { OccupancyZone, Track } from '@osrd-project/ui-charts';
import type { TFunction } from 'i18next';
import {
  flatMap,
  forEach,
  fromPairs,
  isEmpty,
  isEqual,
  isFunction,
  keyBy,
  keys,
  noop,
  pick,
  uniqBy,
} from 'lodash';
import { useTranslation } from 'react-i18next';

import {
  type OperationalPointReference,
  osrdEditoastApi,
  type PathItemLocation,
} from 'common/api/osrdEditoastApi';
import type { TrainId } from 'reducers/osrdconf/types';
import { extractEditoastIdFromTrainId } from 'utils/trainId';

import type { PathOperationalPoint, TrainSpaceTimeData } from '../../types';
import { batchFetchTrackOccupancy } from './helpers/utils';
import { getMovableOccupancyZone, type MovableOccupancyZone } from './helpers/zones';
import { usePrevious } from '../../../../utils/hooks/state';

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
  loading?: boolean;
};

const SIDES = ['origin', 'destination'] as const;
type Side = (typeof SIDES)[number];
export type OccupancyTrainSpaceTimeData = TrainSpaceTimeData &
  Record<`${Side}PathItemLocation`, PathItemLocation | undefined>;

type StationLabel = { type?: 'label'; label: string } | { type: 'requestedPoint' };
function extractStationLabel(
  stationLabel: StationLabel | undefined,
  t: TFunction<'operational-studies'>
): string | undefined {
  if (!stationLabel) return undefined;
  if (stationLabel.type === 'requestedPoint')
    return `${t('main.requestedPointUnknown').slice(0, 3)}…`;
  return stationLabel.label;
}

/**
 * This hook handles track occupancy zones lifecycle.
 *
 * It takes the following inputs:
 * - infraId
 * - trains:
 *   An array with all visible OccupancyTrainSpaceTimeData items in the SpaceTimeChart. These are
 *   TrainSpaceTimeData, but with optional origin and destination PathItemLocation, to allow
 *   displaying related labels.
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
  trains: OccupancyTrainSpaceTimeData[];
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
  const { t, i18n } = useTranslation('operational-studies');
  const draggedTrains = useRef(new Set<string>());
  const previousTrains = usePrevious(trains);

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
  const trainsStationLabelsRef = useRef<
    Record<string, { origin?: StationLabel; destination?: StationLabel } | undefined>
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
            zones: opState.zones.data?.map((zone) => {
              const trainStationLabels = trainsStationLabelsRef.current[zone.trainId];
              return {
                ...zone,
                originStation: extractStationLabel(trainStationLabels?.origin, t),
                destinationStation: extractStationLabel(trainStationLabels?.destination, t),
              };
            }),
            loading: opState.zones.type === 'loading',
            tracks,
          });
        }
      });

    return res;
  }, [pathOperationalPointsState, pathOperationalPointsDict, t]);

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
      if (stopPanning) draggedTrains.current.delete(draggedTrainId);
      else draggedTrains.current.add(draggedTrainId);

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

  // Update train data for all deployed waypoints on trains update:
  useEffect(() => {
    if (!previousTrains || isEqual(trains, previousTrains) || isEmpty(pathOperationalPointsState))
      return;

    const previousTrainsDict = keyBy(previousTrains, (train) =>
      extractEditoastIdFromTrainId(train.id)
    );

    const addedTrainIDs = new Set<number>();
    const removedTrainIDs = new Set<number>();
    const modifiedTrainIDs = new Set<number>();

    trains.forEach((train) => {
      const id = extractEditoastIdFromTrainId(train.id);
      const previousTrain = previousTrainsDict[id];
      if (!previousTrain) addedTrainIDs.add(id);
      else if (!isEqual(train, previousTrain) && !draggedTrains.current.has(train.id)) {
        modifiedTrainIDs.add(id);
        if (
          !isEqual(train.originPathItemLocation, previousTrain.originPathItemLocation) ||
          !isEqual(
            train.destinationPathItemLocation,
            previousTrainsDict[id].destinationPathItemLocation
          )
        ) {
          // Remove cached station labels for this train:
          trainsStationLabelsRef.current[train.id] = undefined;
        }
      }
    });

    previousTrains.forEach((train) => {
      const id = extractEditoastIdFromTrainId(train.id);
      if (!trainsDict[id]) {
        removedTrainIDs.add(id);
        // Remove cached station labels for this train:
        trainsStationLabelsRef.current[train.id] = undefined;
      }
    });

    // Load zones for added trains, for each path operational point that has already been toggled at least once:
    if (addedTrainIDs.size || modifiedTrainIDs.size) {
      forEach(pathOperationalPointsState, async (_, waypointId) => {
        const newZones = await fetchTrackOccupancy(
          pathOperationalPointsDict[waypointId]?.opId,
          pick(trainsDict, [...addedTrainIDs, ...modifiedTrainIDs])
        );

        if (newZones.length)
          updatePathOperationalPointState(waypointId, (state) =>
            state
              ? {
                  ...state,
                  zones: {
                    ...state.zones,
                    data: (state.zones.data || [])
                      .filter(
                        (zone) => !modifiedTrainIDs.has(extractEditoastIdFromTrainId(zone.trainId))
                      )
                      .concat(newZones),
                  },
                }
              : undefined
          );
      });
    }

    // Remove zones for trains that have been removed
    if (removedTrainIDs.size) {
      forEach(pathOperationalPointsState, (_, waypointId) => {
        updatePathOperationalPointState(waypointId, (state) =>
          state
            ? {
                ...state,
                zones: {
                  ...state.zones,
                  data:
                    state.zones.data?.filter(
                      (zone) => !removedTrainIDs.has(extractEditoastIdFromTrainId(zone.trainId))
                    ) || [],
                },
              }
            : undefined
        );
      });
    }
  }, [trains]);

  // Load train origin and destination stations names:
  useEffect(() => {
    const trainsStationLabels = trainsStationLabelsRef.current;
    const trainsToFetch = trains.filter((train) => !trainsStationLabels[train.id]);

    if (!trainsToFetch.length) return;

    const fetchOperationalPoints = async () => {
      try {
        const requests: {
          trainId: TrainId;
          side: Side;
          opReference: OperationalPointReference;
        }[] = [];

        trainsToFetch.forEach((train) => {
          trainsStationLabels[train.id] = {};
          SIDES.forEach((side) => {
            const itemLocation = train[`${side}PathItemLocation`];
            if (!itemLocation) {
              trainsStationLabels[train.id] = {
                ...trainsStationLabels[train.id],
                [side]: undefined,
              };
            } else if ('track' in itemLocation) {
              trainsStationLabels[train.id] = {
                ...trainsStationLabels[train.id],
                [side]: { type: 'requestedPoint' },
              };
            } else if ('operational_point' in itemLocation) {
              requests.push({
                side,
                trainId: train.id,
                opReference: { operational_point: itemLocation.operational_point },
              });
            } else if ('trigram' in itemLocation) {
              requests.push({
                side,
                trainId: train.id,
                opReference: {
                  trigram: itemLocation.trigram,
                  secondary_code: itemLocation.secondary_code,
                },
              });
            } else if ('uic' in itemLocation) {
              requests.push({
                side,
                trainId: train.id,
                opReference: { uic: itemLocation.uic, secondary_code: itemLocation.secondary_code },
              });
            }
          });
        });

        if (!requests.length) return;

        const { data, error } = await postInfraByInfraIdMatchOperationalPoints({
          infraId,
          body: {
            operational_point_references: requests.map(({ opReference }) => opReference),
          },
        });

        if (error)
          throw new Error('Error while fetching tracks origin/destination names', { cause: error });

        requests.forEach(({ side, trainId }, i) => {
          const op = data.related_operational_points[i].at(0);
          trainsStationLabels[trainId] = {
            ...trainsStationLabels[trainId],
            [side]: {
              type: 'label',
              label: op?.extensions?.sncf?.trigram || op?.extensions?.identifier?.name || undefined,
            },
          };
        });
      } catch (e) {
        console.error(e);
      }
    };

    fetchOperationalPoints();
  }, [trains, i18n.language]);

  return { deployedWaypoints, toggleWaypoint, handleTrainDrag };
};

export default useTrackOccupancy;
