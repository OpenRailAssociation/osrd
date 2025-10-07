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
  noop,
  uniqBy,
} from 'lodash';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import {
  type OperationalPointReference,
  osrdEditoastApi,
  type PathItemLocation,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromTrainScheduleId,
  formatEditoastIdToTrainScheduleId,
  isTrainScheduleId,
} from 'utils/trainId';

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
  timetableItemProjections,
  pathOperationalPoints,
}: {
  infraId: number;
  timetableItemProjections: OccupancyTrainSpaceTimeData[];
  pathOperationalPoints: PathOperationalPoint[];
}): {
  deployedWaypoints: DeployedWaypoint[];
  toggleWaypoint: (waypointId: string, selectedState?: boolean) => void;
  updateTrackOccupanciesOnDrag: ({
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
  const previousTimetableItems = usePrevious(timetableItemProjections);

  const { getTrackSectionsByIds } = useScenarioContext();

  const pathOperationalPointsDict = useMemo(
    () => keyBy(pathOperationalPoints, 'waypointId'),
    [pathOperationalPoints]
  );
  const [postTrainScheduleTrackOccupancy] =
    osrdEditoastApi.endpoints.postTrainScheduleTrackOccupancy.useMutation();
  const [postInfraByInfraIdMatchOperationalPoints] =
    osrdEditoastApi.endpoints.postInfraByInfraIdMatchOperationalPoints.useLazyQuery();
  const timetableItemsById: Map<TimetableItemId, OccupancyTrainSpaceTimeData> = useMemo(
    () => new Map(timetableItemProjections.map((item) => [item.id, item])),
    [timetableItemProjections]
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
      trainsCollection: Record<TimetableItemId, TrainSpaceTimeData>
    ): Promise<MovableOccupancyZone[]> =>
      opId
        ? flatMap(
            (
              await postTrainScheduleTrackOccupancy({
                body: {
                  operational_point_id: opId,
                  infra_id: infraId,
                  train_schedule_ids: Object.keys(trainsCollection)
                    .filter((id) => isTrainScheduleId(id))
                    .map((id) => extractEditoastIdFromTrainScheduleId(id)),
                },
              })
            ).data,
            (entries, trackId) =>
              entries.map((entry) =>
                getMovableOccupancyZone(
                  trackId,
                  entry,
                  trainsCollection[formatEditoastIdToTrainScheduleId(entry.train_schedule_id)]
                )
              )
          ) // TODO : append result of postPacedTrainTrackOccupancy
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
          Array.from(timetableItemsById.keys()),
          (ids) =>
            fetchTrackOccupancy(
              pathOperationalPointsDict[waypointId]?.opId,
              Object.fromEntries(ids.map((id) => [id, timetableItemsById.get(id)!]))
            ),
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
      timetableItemsById,
    ]
  );

  const updateTrackOccupanciesOnDrag = useCallback(
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
        const draggedTrainEditoastId = draggedTrainId;
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
    const loadAllTracks = async (operationalPointReferences: { operational_point: string }[]) => {
      setTracksState((state) => ({ type: 'loading', data: state.data || {} }));

      try {
        const data = await postInfraByInfraIdMatchOperationalPoints({
          infraId,
          body: { operational_point_references: operationalPointReferences },
        }).unwrap();

        if (aborted) return;

        const allTrackIds = data.related_operational_points.flatMap(([points]) =>
          points.parts.map((part) => part.track)
        );
        const fetchedTrackSections = await getTrackSectionsByIds(allTrackIds);

        const trackSectionByTrackId = new Map();
        for (const trackSections of Object.values(fetchedTrackSections)) {
          if (trackSections.id) trackSectionByTrackId.set(trackSections.id, trackSections);
        }

        const loadedTracks = fromPairs(
          operationalPointReferences.map(({ operational_point }, i) => [
            operational_point,
            uniqBy(
              data.related_operational_points[i][0].parts.map((part) => {
                const trackPart = trackSectionByTrackId.get(part.track);
                return {
                  id: part.track,
                  name: data.track_names[part.track] || undefined,
                  line: trackPart?.extensions?.sncf?.line_code,
                };
              }),
              (track) => track.id
            ),
          ])
        );
        setTracksState({
          type: 'ok',
          data: loadedTracks,
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
    if (
      !previousTimetableItems ||
      isEqual(timetableItemProjections, previousTimetableItems) ||
      isEmpty(pathOperationalPointsState)
    )
      return;

    const previousTimetableItemsDict = keyBy(
      previousTimetableItems,
      (timetableItem) => timetableItem.id
    );

    const addedTrainIDs = new Set<TimetableItemId>();
    const removedTrainIDs = new Set<TimetableItemId>();
    const modifiedTrainIDs = new Set<TimetableItemId>();

    timetableItemProjections.forEach((timetableItem) => {
      const id = timetableItem.id;
      const previousTimetableItem = previousTimetableItemsDict[id];
      if (!previousTimetableItem) addedTrainIDs.add(id);
      else if (
        !isEqual(timetableItem, previousTimetableItem) &&
        !draggedTrains.current.has(timetableItem.id)
      ) {
        modifiedTrainIDs.add(id);
        if (
          !isEqual(
            timetableItem.originPathItemLocation,
            previousTimetableItem.originPathItemLocation
          ) ||
          !isEqual(
            timetableItem.destinationPathItemLocation,
            previousTimetableItemsDict[id].destinationPathItemLocation
          )
        ) {
          // Remove cached station labels for this train:
          trainsStationLabelsRef.current[timetableItem.id] = undefined;
        }
      }
    });

    previousTimetableItems.forEach((timetableItem) => {
      const id = timetableItem.id;
      if (!timetableItemsById.has(id)) {
        removedTrainIDs.add(id);
        // Remove cached station labels for this train:
        trainsStationLabelsRef.current[timetableItem.id] = undefined;
      }
    });

    // Load zones for added trains, for each path operational point that has already been toggled at least once:
    if (addedTrainIDs.size || modifiedTrainIDs.size) {
      forEach(pathOperationalPointsState, async (_, waypointId) => {
        const newZones = await fetchTrackOccupancy(
          pathOperationalPointsDict[waypointId]?.opId,
          Object.fromEntries(
            [...addedTrainIDs, ...modifiedTrainIDs].map((id) => [id, timetableItemsById.get(id)!])
          )
        );

        if (newZones.length)
          updatePathOperationalPointState(waypointId, (state) =>
            state
              ? {
                  ...state,
                  zones: {
                    ...state.zones,
                    data: (state.zones.data || [])
                      .filter((zone) => !modifiedTrainIDs.has(zone.trainId))
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
                    state.zones.data?.filter((zone) => !removedTrainIDs.has(zone.trainId)) || [],
                },
              }
            : undefined
        );
      });
    }
  }, [timetableItemProjections]);

  // Load train origin and destination stations names:
  useEffect(() => {
    const trainsStationLabels = trainsStationLabelsRef.current;
    const timetableItemsToFetch = timetableItemProjections.filter(
      (timetableItem) => !trainsStationLabels[timetableItem.id]
    );

    if (!timetableItemsToFetch.length) return;

    const fetchOperationalPoints = async () => {
      try {
        const requests: {
          timetableItemId: TimetableItemId;
          side: Side;
          opReference: OperationalPointReference;
        }[] = [];

        timetableItemsToFetch.forEach((timetableItem) => {
          trainsStationLabels[timetableItem.id] = {};
          SIDES.forEach((side) => {
            const itemLocation = timetableItem[`${side}PathItemLocation`];
            if (!itemLocation) {
              trainsStationLabels[timetableItem.id] = {
                ...trainsStationLabels[timetableItem.id],
                [side]: undefined,
              };
            } else if ('track' in itemLocation) {
              trainsStationLabels[timetableItem.id] = {
                ...trainsStationLabels[timetableItem.id],
                [side]: { type: 'requestedPoint' },
              };
            } else if ('operational_point' in itemLocation) {
              requests.push({
                side,
                timetableItemId: timetableItem.id,
                opReference: { operational_point: itemLocation.operational_point },
              });
            } else if ('trigram' in itemLocation) {
              requests.push({
                side,
                timetableItemId: timetableItem.id,
                opReference: {
                  trigram: itemLocation.trigram,
                  secondary_code: itemLocation.secondary_code,
                },
              });
            } else if ('uic' in itemLocation) {
              requests.push({
                side,
                timetableItemId: timetableItem.id,
                opReference: { uic: itemLocation.uic, secondary_code: itemLocation.secondary_code },
              });
            }
          });
        });

        if (!requests.length) return;

        const data = await postInfraByInfraIdMatchOperationalPoints({
          infraId,
          body: {
            operational_point_references: requests.map(({ opReference }) => opReference),
          },
        }).unwrap();

        requests.forEach(({ side, timetableItemId }, i) => {
          const op = data.related_operational_points[i].at(0);
          trainsStationLabels[timetableItemId] = {
            ...trainsStationLabels[timetableItemId],
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
  }, [timetableItemProjections, i18n.language]);

  return { deployedWaypoints, toggleWaypoint, updateTrackOccupanciesOnDrag };
};

export default useTrackOccupancy;
