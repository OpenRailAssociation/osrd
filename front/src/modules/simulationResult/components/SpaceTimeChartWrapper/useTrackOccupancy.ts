import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { OccupancyZone, Track } from '@osrd-project/ui-charts';
import type { TFunction } from 'i18next';
import { forEach, fromPairs, isEmpty, isEqual, isFunction, keyBy, noop, uniqBy } from 'lodash';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import {
  type OperationalPointReference,
  osrdEditoastApi,
  type PathItemLocation,
} from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import { computeIndexedOccurrenceStartTime } from 'modules/timetableItem/helpers/pacedTrain';
import type {
  PacedTrainId,
  TimetableItemId,
  TrainId,
  TrainScheduleId,
} from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  extractPacedTrainIdFromOccurrenceId,
  formatEditoastIdToPacedTrainId,
  formatEditoastIdToTrainScheduleId,
  formatPacedTrainIdToExceptionId,
  formatPacedTrainIdToIndexedOccurrenceId,
  isOccurrenceId,
  isPacedTrainId,
  isTrainScheduleId,
} from 'utils/trainId';

import type { PathOperationalPoint, TrainSpaceTimeData } from '../../types';
import { batchFetchTrackOccupancy, isTrainScheduleProjection } from './helpers/utils';
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
  pathfindingHasFailed = false,
}: {
  infraId: number;
  timetableItemProjections: OccupancyTrainSpaceTimeData[];
  pathOperationalPoints: PathOperationalPoint[];
  pathfindingHasFailed?: boolean;
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
  const draggedTimetableItemIds = useRef(new Set<TimetableItemId>());
  const previousTimetableItems = usePrevious(timetableItemProjections);
  const { getTrackSectionsByIds } = useScenarioContext();

  const pathOperationalPointsDict = useMemo(
    () => keyBy(pathOperationalPoints, 'waypointId'),
    [pathOperationalPoints]
  );
  const [postTrainScheduleTrackOccupancy] =
    osrdEditoastApi.endpoints.postTrainScheduleTrackOccupancy.useMutation();
  const [postPacedTrainTrackOccupancy] =
    osrdEditoastApi.endpoints.postPacedTrainTrackOccupancy.useMutation();
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

  const toOwnerTimetableItemId = (id: TrainId): TimetableItemId =>
    isTrainScheduleId(id) ? id : extractPacedTrainIdFromOccurrenceId(id);

  const fetchTrackOccupancy = useCallback(
    async (
      opId: string | undefined | null,
      trainsCollection: Record<TimetableItemId, TrainSpaceTimeData>
    ): Promise<MovableOccupancyZone[]> => {
      if (!opId) return [];

      const trainScheduleIds: TrainScheduleId[] = [];
      const pacedTrainIds: PacedTrainId[] = [];
      for (const id of Object.keys(trainsCollection)) {
        if (isTrainScheduleId(id)) trainScheduleIds.push(id);
        else if (isPacedTrainId(id)) pacedTrainIds.push(id);
      }

      const bodyForTrainSchedules =
        trainScheduleIds.length > 0
          ? {
              operational_point_id: opId,
              infra_id: infraId,
              train_schedule_ids: trainScheduleIds.map(extractEditoastIdFromTrainScheduleId),
            }
          : null;

      const bodyForPaced =
        pacedTrainIds.length > 0
          ? {
              operational_point_id: opId,
              infra_id: infraId,
              paced_train_ids: pacedTrainIds.map(extractEditoastIdFromPacedTrainId),
            }
          : null;

      const [trainScheduleResp, pacedResp] = await Promise.all([
        bodyForTrainSchedules
          ? postTrainScheduleTrackOccupancy({ body: bodyForTrainSchedules })
          : Promise.resolve(undefined),
        bodyForPaced
          ? postPacedTrainTrackOccupancy({ body: bodyForPaced })
          : Promise.resolve(undefined),
      ]);

      const zones: MovableOccupancyZone[] = [];

      if (trainScheduleResp?.data) {
        for (const [trackId, occupations] of Object.entries(trainScheduleResp.data)) {
          for (const occupation of occupations) {
            const trainId = formatEditoastIdToTrainScheduleId(occupation.train_schedule_id);
            const train = trainsCollection[trainId];
            if (!train) continue;

            zones.push(
              getMovableOccupancyZone(
                trackId,
                trainId,
                occupation,
                train.spaceTimeCurves,
                train.name,
                train.departureTime
              )
            );
          }
        }
      }

      if (pacedResp?.data) {
        for (const [trackId, occupations] of Object.entries(pacedResp.data)) {
          for (const occupation of occupations) {
            const pacedId = formatEditoastIdToPacedTrainId(occupation.paced_train_id);
            const train = trainsCollection[pacedId];
            if (!train || isTrainScheduleProjection(train)) {
              continue;
            }

            const exception =
              occupation.type === 'BaseOccurrence'
                ? undefined
                : train.paced.exceptions.find((e) => e.key === occupation.exception_key);

            const exceptionProjection =
              occupation.type !== 'BaseOccurrence'
                ? train.paced.exceptionProjections.get(occupation.exception_key)
                : undefined;

            const { spaceTimeCurves } = exceptionProjection ?? train;

            let trainId: TrainId;
            let trainName: string;
            let startTime: Date;

            if (occupation.type === 'CreatedException') {
              if (!exception?.start_time?.value) continue;

              trainId = formatPacedTrainIdToExceptionId(pacedId, occupation.exception_key);
              trainName = exception.train_name?.value ?? `${train.name}/+`;
              startTime = new Date(exception.start_time.value);
            } else {
              trainId = formatPacedTrainIdToIndexedOccurrenceId(pacedId, occupation.index);
              trainName =
                exception?.train_name?.value ?? computeOccurrenceName(train.name, occupation.index);

              startTime = exception?.start_time?.value
                ? new Date(exception.start_time.value)
                : computeIndexedOccurrenceStartTime(
                    new Date(train.departureTime),
                    train.paced.interval,
                    occupation.index
                  );
            }

            zones.push(
              getMovableOccupancyZone(
                trackId,
                trainId,
                occupation,
                spaceTimeCurves,
                trainName,
                startTime,
                exception
              )
            );
          }
        }
      }

      return zones;
    },
    [infraId, postTrainScheduleTrackOccupancy, postPacedTrainTrackOccupancy]
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

        // refresh zones when reopening waypoint, if TOD was closed.
        if (!currentSelected && newSelected) {
          const opId = pathOperationalPointsDict[waypointId]?.opId;
          if (!opId) return;

          const trains = Object.fromEntries(Array.from(timetableItemsById.entries()));

          fetchTrackOccupancy(opId, trains).then((newZones) => {
            if (!newZones.length) return;

            updatePathOperationalPointState(waypointId, (state) =>
              state
                ? {
                    ...state,
                    zones: {
                      type: 'ok',
                      data: newZones,
                    },
                  }
                : undefined
            );
          });
        }
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
      const draggedTimetableItemId = toOwnerTimetableItemId(draggedTrainId);
      if (stopPanning) draggedTimetableItemIds.current.delete(draggedTimetableItemId);
      else draggedTimetableItemIds.current.add(draggedTimetableItemId);

      // Update actual state:
      const impactedPathOperationalPointIDs = new Set<string>();
      const newState = { ...pathOperationalPointsState };
      forEach(newState, (opState, waypointId) => {
        if (opState.selected) {
          forEach(opState.zones.data, (zone) => {
            if (
              (isTrainScheduleId(zone.trainId) && zone.trainId === draggedTrainId) ||
              (isOccurrenceId(zone.trainId) &&
                extractPacedTrainIdFromOccurrenceId(zone.trainId) === draggedTimetableItemId &&
                !zone.isStartTimeException)
            ) {
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
    if (pathfindingHasFailed) {
      return;
    }

    let aborted = false;

    const pathOperationalPointsWithoutTracks = pathOperationalPoints.filter(
      (op) => !(tracksState.data || {})[op.waypointId]
    );
    const loadAllTracks = async (
      operationalPointReferences: { operational_point: { operational_point: string } }[]
    ) => {
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
          operationalPointReferences.map(({ operational_point: { operational_point } }, i) => [
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
      op.opId ? [{ operational_point: { operational_point: op.opId } }] : []
    );
    if (!waypointsPayload.length) return noop;

    loadAllTracks(waypointsPayload);
    return () => {
      aborted = true;
    };
  }, [pathOperationalPoints, pathfindingHasFailed]);

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
        !draggedTimetableItemIds.current.has(timetableItem.id)
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
        if (newZones.length) {
          updatePathOperationalPointState(waypointId, (state) =>
            state
              ? {
                  ...state,
                  zones: {
                    ...state.zones,
                    data: (state.zones.data || [])
                      .filter((zone) => !modifiedTrainIDs.has(toOwnerTimetableItemId(zone.trainId)))
                      .concat(newZones),
                  },
                }
              : undefined
          );
        }
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
                      (zone) => !removedTrainIDs.has(toOwnerTimetableItemId(zone.trainId))
                    ) || [],
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
            } else if ('operational_point' in itemLocation.operational_point) {
              requests.push({
                side,
                timetableItemId: timetableItem.id,
                opReference: {
                  operational_point: {
                    operational_point: itemLocation.operational_point.operational_point,
                  },
                },
              });
            } else if ('trigram' in itemLocation.operational_point) {
              requests.push({
                side,
                timetableItemId: timetableItem.id,
                opReference: {
                  operational_point: {
                    trigram: itemLocation.operational_point.trigram,
                    secondary_code: itemLocation.operational_point.secondary_code,
                  },
                },
              });
            } else if ('uic' in itemLocation.operational_point) {
              requests.push({
                side,
                timetableItemId: timetableItem.id,
                opReference: {
                  operational_point: {
                    uic: itemLocation.operational_point.uic,
                    secondary_code: itemLocation.operational_point.secondary_code,
                  },
                },
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
