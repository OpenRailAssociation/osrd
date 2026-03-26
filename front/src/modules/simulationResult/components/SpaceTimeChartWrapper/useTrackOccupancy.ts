import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { OccupancyZone, Track } from '@osrd-project/ui-charts';
import type { TFunction } from 'i18next';
import { forEach, fromPairs, isEmpty, isEqual, isFunction, keyBy, noop, uniqBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { type OperationalPointReference, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import { computeIndexedOccurrenceStartTime } from 'modules/timetableItem/helpers/pacedTrain';
import type { SimulatedException } from 'modules/timetableItem/types';
import type { PacedTrainId, TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import { getIsSimulationEnabled } from 'reducers/simulationResults/selectors';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  formatEditoastIdToPacedTrainId,
  formatPacedTrainIdToExceptionId,
  formatPacedTrainIdToIndexedOccurrenceId,
  isOccurrenceId,
  isPacedTrainId,
} from 'utils/trainId';
import { mapBy } from 'utils/types';

import type { BaseTrainProjection, PathOperationalPoint, TrainSpaceTimeData } from '../../types';
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

function getOperationalPointReference(
  op: PathOperationalPoint | undefined
): OperationalPointReference | undefined {
  if (!op) return undefined;
  if (op.opId) return { type: 'id', operational_point: op.opId };
  const trigram = op.extensions?.sncf?.trigram;
  if (trigram) return { type: 'trigram', trigram, secondary_code: op.extensions?.sncf?.ch };
  const uic = op.extensions?.identifier?.uic;
  if (uic != null) return { type: 'uic', uic, secondary_code: op.extensions?.sncf?.ch };
  return undefined;
}

/**
 * This hook handles track occupancy zones lifecycle.
 *
 * It takes the following inputs:
 * - infraId
 * - trains: An array with all visible TrainSpaceTimeData items in the SpaceTimeChart.
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
  timetableId,
  timetableItemProjections,
  pathOperationalPoints,
  pathfindingHasFailed = false,
}: {
  infraId: number;
  timetableId: number;
  timetableItemProjections: TrainSpaceTimeData[];
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
  const previousTimetableItemProjections = usePrevious(timetableItemProjections);
  const { getTrackSectionsByIds } = useScenarioContext();

  const pathOpsByWaypointId = useMemo(
    () => mapBy(pathOperationalPoints, 'waypointId'),
    [pathOperationalPoints]
  );

  const [postTrainSchedulesTrackOccupancy] =
    osrdEditoastApi.endpoints.postTrainSchedulesTrackOccupancy.useMutation();
  const isSimulationEnabled = useSelector(getIsSimulationEnabled);
  const [postInfraByInfraIdMatchOperationalPoints] =
    osrdEditoastApi.endpoints.postInfraByInfraIdMatchOperationalPoints.useLazyQuery();
  const timetableItemProjectionsById: Map<TimetableItemId, TrainSpaceTimeData> = useMemo(
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
  const localTrackNameToTrackIdRef = useRef<Map<string, Map<string, string>>>(new Map());
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
    !isOccurrenceId(id) ? id : extractPacedTrainIdFromOccurrenceId(id);

  const fetchTrackOccupancy = useCallback(
    async (
      opRef: OperationalPointReference | undefined | null,
      opId: string | undefined | null,
      trainsCollection: Record<TimetableItemId, TrainSpaceTimeData>
    ): Promise<MovableOccupancyZone[]> => {
      if (!opRef) return [];

      const pacedTrainIds: PacedTrainId[] = [];
      for (const id of Object.keys(trainsCollection)) {
        if (isPacedTrainId(id)) pacedTrainIds.push(id);
      }

      const bodyForPaced =
        pacedTrainIds.length > 0
          ? {
              operational_point_reference: opRef,
              infra_id: infraId,
              timetable_id: timetableId,
              train_schedule_ids: pacedTrainIds.map(extractEditoastIdFromPacedTrainId),
              use_simulation: isSimulationEnabled,
            }
          : null;

      const pacedResp = await (bodyForPaced
        ? postTrainSchedulesTrackOccupancy({ body: bodyForPaced })
        : Promise.resolve(undefined));

      const zones: MovableOccupancyZone[] = [];

      if (pacedResp?.data) {
        for (const trackItem of pacedResp.data) {
          const { local_track_name: localTrackName, trains } = trackItem;
          if (!localTrackName) continue;
          const trackId = opId
            ? localTrackNameToTrackIdRef.current.get(opId)?.get(localTrackName)
            : undefined;
          if (!trackId) continue;
          for (const occupation of trains) {
            const pacedId = formatEditoastIdToPacedTrainId(occupation.train_schedule_id);
            const train = trainsCollection[pacedId];

            if (!train) throw new Error(`No train found for id ${pacedId}`);

            if (!train.paced) {
              if (occupation.type !== 'base') {
                throw new Error(
                  `Invalid occupation type ${occupation.type} for unique train ${train.id}`
                );
              }
              zones.push(
                getMovableOccupancyZone(
                  trackId,
                  pacedId,
                  occupation,
                  train.spaceTimeCurves,
                  train.name,
                  train.departureTime
                )
              );
              continue;
            }

            let exception: SimulatedException | undefined;
            let exceptionProjection: BaseTrainProjection | undefined;
            if (occupation.type !== 'base') {
              exception = train.paced.exceptions.find((e) => e.key === occupation.exception_key);
              exceptionProjection = train.paced.exceptionProjections.get(occupation.exception_key);
              if (!exception) throw new Error(`Exception not found for train ${train.id}`);
            }

            const { spaceTimeCurves } = exceptionProjection ?? train;

            let trainId: TrainId;
            let trainName: string;
            let startTime: Date;

            if (occupation.type === 'created') {
              if (!exception?.start_time?.value)
                throw new Error(`Created exceptions should always be a start time exception`);

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
    [infraId, postTrainSchedulesTrackOccupancy, isSimulationEnabled]
  );

  const deployedWaypoints = useMemo(() => {
    const res: DeployedWaypoint[] = [];

    if (tracksState.type === 'ok')
      forEach(pathOperationalPointsState, (opState, waypointId) => {
        const op = pathOpsByWaypointId.get(waypointId);
        if (opState.selected && op?.opId) {
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
  }, [pathOperationalPointsState, pathOpsByWaypointId, t]);

  const toggleWaypoint = useCallback(
    (waypointId: string, selectedState?: boolean) => {
      const waypoint = pathOpsByWaypointId.get(waypointId);
      if (!waypoint)
        throw new Error(`Waypoint ${waypointId} has not been provided to useTrackOccupancy.`);

      const currentState = pathOperationalPointsState[waypointId];
      const currentSelected = !!currentState?.selected;
      const newSelected = typeof selectedState === 'boolean' ? selectedState : !currentSelected;
      if (currentSelected === newSelected) return;

      // Start fetching data:
      if (!currentState) {
        const abort = batchFetchTrackOccupancy(
          Array.from(timetableItemProjectionsById.keys()),
          (ids) =>
            fetchTrackOccupancy(
              getOperationalPointReference(waypoint),
              waypoint.opId,
              Object.fromEntries(ids.map((id) => [id, timetableItemProjectionsById.get(id)!]))
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
          const opRef = getOperationalPointReference(pathOpsByWaypointId.get(waypointId));
          if (!opRef) return;

          const trains = Object.fromEntries(Array.from(timetableItemProjectionsById.entries()));

          fetchTrackOccupancy(opRef, waypoint.opId, trains).then((newZones) => {
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
      pathOpsByWaypointId,
      pathOperationalPointsState,
      updatePathOperationalPointState,
      timetableItemProjectionsById,
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
              isOccurrenceId(zone.trainId) &&
              extractPacedTrainIdFromOccurrenceId(zone.trainId) === draggedTimetableItemId &&
              !zone.isStartTimeException
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
              getOperationalPointReference(pathOpsByWaypointId.get(waypointId)),
              pathOpsByWaypointId.get(waypointId)?.opId,
              {
                [draggedTrainEditoastId]: newTrainData,
              }
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
    [pathOpsByWaypointId, pathOperationalPointsState]
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
      operationalPointReferences: { operational_point: string; type: 'id' }[]
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

        localTrackNameToTrackIdRef.current = new Map();

        data.related_operational_points.forEach(([operationalPoint]) => {
          if (!operationalPoint) return;
          const mapping = new Map<string, string>();
          for (const part of operationalPoint.parts) {
            mapping.set(part.local_track_name, part.track);
          }
          localTrackNameToTrackIdRef.current.set(operationalPoint.id, mapping);
        });

        const loadedTracks = fromPairs(
          operationalPointReferences.map(({ operational_point }, i) => [
            operational_point,
            uniqBy(
              data.related_operational_points[i][0].parts.map((part) => {
                const trackPart = trackSectionByTrackId.get(part.track);
                return {
                  id: part.track,
                  name: part.local_track_name,
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
      op.opId ? [{ operational_point: op.opId, type: 'id' as const }] : []
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
      !previousTimetableItemProjections ||
      isEqual(timetableItemProjections, previousTimetableItemProjections) ||
      isEmpty(pathOperationalPointsState)
    )
      return;

    const previousTimetableItemsDict = keyBy(
      previousTimetableItemProjections,
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
          !isEqual(timetableItem.originPathItem, previousTimetableItem.originPathItem) ||
          !isEqual(
            timetableItem.destinationPathItem,
            previousTimetableItemsDict[id].destinationPathItem
          )
        ) {
          // Remove cached station labels for this train:
          trainsStationLabelsRef.current[timetableItem.id] = undefined;
        }
      }
    });

    previousTimetableItemProjections.forEach((timetableItem) => {
      const id = timetableItem.id;
      if (!timetableItemProjectionsById.has(id)) {
        removedTrainIDs.add(id);
        // Remove cached station labels for this train:
        trainsStationLabelsRef.current[timetableItem.id] = undefined;
      }
    });

    // Load zones for added trains, for each path operational point that has already been toggled at least once:
    if (addedTrainIDs.size || modifiedTrainIDs.size) {
      forEach(pathOperationalPointsState, async (_, waypointId) => {
        const newZones = await fetchTrackOccupancy(
          getOperationalPointReference(pathOpsByWaypointId.get(waypointId)),
          pathOpsByWaypointId.get(waypointId)?.opId,
          Object.fromEntries(
            [...addedTrainIDs, ...modifiedTrainIDs].map((id) => [
              id,
              timetableItemProjectionsById.get(id)!,
            ])
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
          side: 'origin' | 'destination';
          opReference: OperationalPointReference;
        }[] = [];

        timetableItemsToFetch.forEach((timetableItem) => {
          trainsStationLabels[timetableItem.id] = {};
          (['origin', 'destination'] as const).forEach((side) => {
            const itemLocation = timetableItem[`${side}PathItem`].location;
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
            } else if (itemLocation.operational_point.type === 'id') {
              requests.push({
                side,
                timetableItemId: timetableItem.id,
                opReference: {
                  operational_point: itemLocation.operational_point.operational_point,
                  type: 'id',
                },
              });
            } else if (itemLocation.operational_point.type === 'trigram') {
              requests.push({
                side,
                timetableItemId: timetableItem.id,
                opReference: {
                  trigram: itemLocation.operational_point.trigram,
                  secondary_code: itemLocation.operational_point.secondary_code,
                  type: 'trigram',
                },
              });
            } else if (itemLocation.operational_point.type === 'uic') {
              requests.push({
                side,
                timetableItemId: timetableItem.id,
                opReference: {
                  uic: itemLocation.operational_point.uic,
                  secondary_code: itemLocation.operational_point.secondary_code,
                  type: 'uic',
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
