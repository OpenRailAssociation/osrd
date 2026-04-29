import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { OccupancyZone, Track } from '@osrd-project/ui-charts';
import type { TFunction } from 'i18next';
import { forEach, fromPairs, isEmpty, isEqual, isFunction, keyBy, noop, uniqBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { type OperationalPointReference, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/trainSchedule/helpers/computeOccurrenceName';
import { computeIndexedOccurrenceStartTime } from 'modules/trainSchedule/helpers/pacedTrain';
import type { SimulatedException } from 'modules/trainSchedule/types';
import type { TrainId } from 'reducers/osrdconf/types';
import { getIsSimulationEnabled } from 'reducers/simulationResults/selectors';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  formatEditoastIdToPacedTrainId,
  formatPacedTrainIdToExceptionId,
  formatPacedTrainIdToIndexedOccurrenceId,
  isOccurrenceId,
} from 'utils/trainId';
import { mapBy } from 'utils/types';

import { usePrevious } from '../../../../utils/hooks/state';
import type { BaseTrainProjection, PathOperationalPoint, TrainSpaceTimeData } from '../../types';
import { NO_TRACK_SPECIFIED_SYMBOL, sortTracks } from './helpers/sortTracks';
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
  // Only use the opId when it refers to a real infra OP. Virtual OPs (unrecognised, created
  // by usePathProjection when pathfinding fails) have a synthetic id like "virtual_op_Zürich"
  // and an empty part.track — they must be matched by trigram/uic instead.
  if (op.opId && op.part?.track) return { type: 'id', operational_point: op.opId };
  // Normalize empty string ch to null — virtual OPs store ch as '' when the original
  // secondary_code was null (see usePathProjection createVirtualOp), and passing ''
  // to the backend would filter for OPs with an empty secondary_code rather than any.
  const ch = op.extensions?.sncf?.ch || null;
  const trigram = op.extensions?.sncf?.trigram;
  if (trigram) return { type: 'trigram', trigram, secondary_code: ch };
  const uic = op.extensions?.identifier?.uic;
  if (uic != null) return { type: 'uic', uic, secondary_code: ch };
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
  trainScheduleProjections,
  pathOperationalPoints,
}: {
  infraId: number;
  timetableId: number;
  trainScheduleProjections: TrainSpaceTimeData[];
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
  const draggedTrainScheduleIds = useRef(new Set<number>());
  const previousTrainScheduleProjections = usePrevious(trainScheduleProjections);
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
  const trainScheduleProjectionsById: Map<number, TrainSpaceTimeData> = useMemo(
    () => new Map(trainScheduleProjections.map((train) => [train.id, train])),
    [trainScheduleProjections]
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

  const toOwnerTrainScheduleId = (id: TrainId): number =>
    extractEditoastIdFromPacedTrainId(
      !isOccurrenceId(id) ? id : extractPacedTrainIdFromOccurrenceId(id)
    );

  const fetchTrackOccupancy = useCallback(
    async (
      opRef: OperationalPointReference | undefined | null,
      waypointId: string | undefined | null,
      trainsCollection: Record<number, TrainSpaceTimeData>
    ): Promise<MovableOccupancyZone[]> => {
      if (!opRef) return [];

      const trainScheduleIds = Object.values(trainsCollection).map((train) => train.id);

      const bodyForPaced =
        trainScheduleIds.length > 0
          ? {
              operational_point_reference: opRef,
              infra_id: infraId,
              timetable_id: timetableId,
              train_schedule_ids: trainScheduleIds,
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
          let trackId: string;
          if (!localTrackName) {
            trackId = NO_TRACK_SPECIFIED_SYMBOL;
          } else {
            const mappedTrackId = waypointId
              ? localTrackNameToTrackIdRef.current.get(waypointId)?.get(localTrackName)
              : undefined;
            // If the track name isn't found in infra, use the name itself as a virtual track ID
            trackId = mappedTrackId ?? localTrackName;
          }
          for (const occupation of trains) {
            const itemId = occupation.train_schedule_id;
            const pacedTrainId = formatEditoastIdToPacedTrainId(itemId);
            const train = trainsCollection[itemId];

            if (!train) throw new Error(`No train found for id ${itemId}`);

            if (!train.paced) {
              if (occupation.type !== 'base') {
                throw new Error(
                  `Invalid occupation type ${occupation.type} for unique train ${train.id}`
                );
              }
              zones.push(
                getMovableOccupancyZone(
                  trackId,
                  pacedTrainId,
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
              exception = train.paced.exceptions.find((e) => e.id === occupation.exception_id);
              exceptionProjection = train.paced.exceptionProjections.get(occupation.exception_id);
              if (!exception) throw new Error(`Exception not found for train ${train.id}`);
            }

            const { spaceTimeCurves } = exceptionProjection ?? train;

            let trainId: TrainId;
            let trainName: string;
            let startTime: Date;

            if (occupation.type === 'created') {
              if (!exception?.start_time?.value)
                throw new Error(`Created exceptions should always be a start time exception`);

              trainId = formatPacedTrainIdToExceptionId(pacedTrainId, occupation.exception_id);
              trainName = exception.train_name?.value ?? `${train.name}/+`;
              startTime = new Date(exception.start_time.value);
            } else {
              trainId = formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, occupation.index);
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
    const tracksData = tracksState.data ?? {};

    forEach(pathOperationalPointsState, (opState, waypointId) => {
      const op = pathOpsByWaypointId.get(waypointId);
      if (opState.selected && op) {
        const infraTracks = tracksData[waypointId] || [];
        const infraTrackIds = new Set(infraTracks.map((track) => track.id));
        const virtualTrackIds = new Set<string>();
        const trackMapping = localTrackNameToTrackIdRef.current.get(waypointId);

        // Remap zones whose trackId is a local_track_name stored before the infra mapping was
        // ready (race condition between fetchTrackOccupancy and loadAllTracks). Once the infra
        // mapping is available via localTrackNameToTrackIdRef, resolve them to the real track
        // section ID so zones land on the correct infra track row. Also collect virtual tracks
        // (IDs still not found in infra after remapping).
        const resolvedZones = opState.zones.data?.map((zone) => {
          // Paced-train occurrences have OccurrenceId zone IDs, but labels are stored under
          // the parent PacedTrainId — use toOwnerTrainScheduleId to resolve both cases.
          const trainStationLabels =
            trainsStationLabelsRef.current[toOwnerTrainScheduleId(zone.trainId)];
          const withLabels = {
            ...zone,
            originStation: extractStationLabel(trainStationLabels?.origin, t),
            destinationStation: extractStationLabel(trainStationLabels?.destination, t),
          };
          if (!infraTrackIds.has(zone.trackId) && trackMapping) {
            const remappedId = trackMapping.get(zone.trackId);
            if (remappedId) {
              if (!infraTrackIds.has(remappedId)) virtualTrackIds.add(remappedId);
              return { ...withLabels, trackId: remappedId };
            }
          }
          if (!infraTrackIds.has(zone.trackId)) virtualTrackIds.add(zone.trackId);
          return withLabels;
        });

        const virtualTracks: Track[] = [...virtualTrackIds].map((id) => ({
          id,
          name: id,
        }));

        res.push({
          waypointId,
          operationalPointId: op.opId ?? waypointId,
          operationalPointPosition: op.position,
          operationalPointName: op.extensions?.identifier?.name || undefined,
          zones: resolvedZones,
          loading: opState.zones.type === 'loading',
          tracks: sortTracks(infraTracks, virtualTracks),
        });
      }
    });

    return res;
  }, [pathOperationalPointsState, pathOpsByWaypointId, tracksState, t]);

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
          Array.from(trainScheduleProjectionsById.keys()),
          (ids) =>
            fetchTrackOccupancy(
              getOperationalPointReference(waypoint),
              waypointId,
              Object.fromEntries(ids.map((id) => [id, trainScheduleProjectionsById.get(id)!]))
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

          const trains = Object.fromEntries(Array.from(trainScheduleProjectionsById.entries()));

          fetchTrackOccupancy(opRef, waypointId, trains).then((newZones) => {
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
      trainScheduleProjectionsById,
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
      const draggedTrainScheduleId = toOwnerTrainScheduleId(draggedTrainId);
      if (stopPanning) draggedTrainScheduleIds.current.delete(draggedTrainScheduleId);
      else draggedTrainScheduleIds.current.add(draggedTrainScheduleId);

      // Update actual state:
      const draggedPacedTrainId = formatEditoastIdToPacedTrainId(draggedTrainScheduleId);
      const impactedPathOperationalPointIDs = new Set<string>();
      const newState = { ...pathOperationalPointsState };
      forEach(newState, (opState, waypointId) => {
        if (opState.selected) {
          forEach(opState.zones.data, (zone) => {
            if (
              isOccurrenceId(zone.trainId) &&
              extractPacedTrainIdFromOccurrenceId(zone.trainId) === draggedPacedTrainId &&
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
        await Promise.all(
          [...impactedPathOperationalPointIDs].map(async (waypointId) => {
            const newZones = await fetchTrackOccupancy(
              getOperationalPointReference(pathOpsByWaypointId.get(waypointId)),
              waypointId,
              {
                [draggedTrainId]: newTrainData,
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
    let aborted = false;

    const pathOperationalPointsWithoutTracks = pathOperationalPoints.filter(
      (op) => !(tracksState.data || {})[op.waypointId]
    );
    const loadAllTracks = async (
      opsWithReferences: {
        waypointId: string;
        reference: OperationalPointReference;
      }[]
    ) => {
      setTracksState((state) => ({ type: 'loading', data: state.data || {} }));

      try {
        const data = await postInfraByInfraIdMatchOperationalPoints({
          infraId,
          body: {
            operational_point_references: opsWithReferences.map((o) => o.reference),
          },
        }).unwrap();

        if (aborted) return;

        const allTrackIds = data.related_operational_points.flatMap((point) =>
          point ? point.parts.map((part) => part.track) : []
        );
        const fetchedTrackSections = await getTrackSectionsByIds(allTrackIds);

        const trackSectionByTrackId = new Map();
        for (const trackSections of Object.values(fetchedTrackSections)) {
          if (trackSections.id) trackSectionByTrackId.set(trackSections.id, trackSections);
        }

        opsWithReferences.forEach(({ waypointId: wId }, i) => {
          const operationalPoint = data.related_operational_points[i];
          if (!operationalPoint) return;
          const mapping = new Map<string, string>();
          for (const part of operationalPoint.parts) {
            mapping.set(part.local_track_name, part.track);
          }
          localTrackNameToTrackIdRef.current.set(wId, mapping);
        });

        const loadedTracks = fromPairs(
          opsWithReferences.map(({ waypointId: wId }, i) => [
            wId,
            uniqBy(
              (data.related_operational_points[i]?.parts ?? []).map((part) => {
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
        setTracksState((state) => ({
          type: 'ok',
          data: { ...(state.data ?? {}), ...loadedTracks },
        }));
      } catch (e) {
        console.error(e);
      }
    };
    const waypointsPayload = pathOperationalPointsWithoutTracks.flatMap<{
      waypointId: string;
      reference: OperationalPointReference;
    }>((op) => {
      const reference = getOperationalPointReference(op);
      if (!reference) return [];
      return [{ waypointId: op.waypointId, reference }];
    });
    if (!waypointsPayload.length) {
      setTracksState((state) => ({ type: 'ok', data: state.data || {} }));
      return noop;
    }

    loadAllTracks(waypointsPayload);
    return () => {
      aborted = true;
    };
  }, [pathOperationalPoints]);

  // Update train data for all deployed waypoints on trains update:
  useEffect(() => {
    if (
      !previousTrainScheduleProjections ||
      isEqual(trainScheduleProjections, previousTrainScheduleProjections) ||
      isEmpty(pathOperationalPointsState)
    )
      return;

    const previousTrainSchedulesDict = keyBy(
      previousTrainScheduleProjections,
      (trainSchedule) => trainSchedule.id
    );

    const addedTrainIDs = new Set<number>();
    const removedTrainIDs = new Set<number>();
    const modifiedTrainIDs = new Set<number>();
    trainScheduleProjections.forEach((trainSchedule) => {
      const id = trainSchedule.id;
      const previousTrainSchedule = previousTrainSchedulesDict[id];
      if (!previousTrainSchedule) addedTrainIDs.add(id);
      else if (
        !isEqual(trainSchedule, previousTrainSchedule) &&
        !draggedTrainScheduleIds.current.has(trainSchedule.id)
      ) {
        modifiedTrainIDs.add(id);
        if (
          !isEqual(trainSchedule.originPathItem, previousTrainSchedule.originPathItem) ||
          !isEqual(
            trainSchedule.destinationPathItem,
            previousTrainSchedulesDict[id].destinationPathItem
          )
        ) {
          // Remove cached station labels for this train:
          trainsStationLabelsRef.current[trainSchedule.id] = undefined;
        }
      }
    });

    previousTrainScheduleProjections.forEach((trainSchedule) => {
      const id = trainSchedule.id;
      if (!trainScheduleProjectionsById.has(id)) {
        removedTrainIDs.add(id);
        // Remove cached station labels for this train:
        trainsStationLabelsRef.current[trainSchedule.id] = undefined;
      }
    });

    // Load zones for added trains, for each path operational point that has already been toggled at least once:
    if (addedTrainIDs.size || modifiedTrainIDs.size) {
      forEach(pathOperationalPointsState, async (_, waypointId) => {
        const newZones = await fetchTrackOccupancy(
          getOperationalPointReference(pathOpsByWaypointId.get(waypointId)),
          waypointId,
          Object.fromEntries(
            [...addedTrainIDs, ...modifiedTrainIDs].map((id) => [
              id,
              trainScheduleProjectionsById.get(id)!,
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
                      .filter((zone) => !modifiedTrainIDs.has(toOwnerTrainScheduleId(zone.trainId)))
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
                      (zone) => !removedTrainIDs.has(toOwnerTrainScheduleId(zone.trainId))
                    ) || [],
                },
              }
            : undefined
        );
      });
    }
  }, [trainScheduleProjections]);

  // Load train origin and destination stations names:
  useEffect(() => {
    const trainsStationLabels = trainsStationLabelsRef.current;
    const trainSchedulesToFetch = trainScheduleProjections.filter(
      (trainSchedule) => !trainsStationLabels[trainSchedule.id]
    );

    if (!trainSchedulesToFetch.length) return;

    const fetchOperationalPoints = async () => {
      try {
        const requests: {
          trainScheduleId: number;
          side: 'origin' | 'destination';
          opReference: OperationalPointReference;
        }[] = [];

        trainSchedulesToFetch.forEach((trainSchedule) => {
          trainsStationLabels[trainSchedule.id] = {};
          (['origin', 'destination'] as const).forEach((side) => {
            const itemLocation = trainSchedule[`${side}PathItem`].location;
            if (!itemLocation) {
              trainsStationLabels[trainSchedule.id] = {
                ...trainsStationLabels[trainSchedule.id],
                [side]: undefined,
              };
            } else if (itemLocation.type === 'track_offset') {
              trainsStationLabels[trainSchedule.id] = {
                ...trainsStationLabels[trainSchedule.id],
                [side]: { type: 'requestedPoint' },
              };
            } else if (itemLocation.operational_point.type === 'id') {
              requests.push({
                side,
                trainScheduleId: trainSchedule.id,
                opReference: {
                  operational_point: itemLocation.operational_point.operational_point,
                  type: 'id',
                },
              });
            } else if (itemLocation.operational_point.type === 'trigram') {
              trainsStationLabels[trainSchedule.id] = {
                ...trainsStationLabels[trainSchedule.id],
                [side]: {
                  type: 'label',
                  label: itemLocation.operational_point.trigram,
                },
              };
            } else if (itemLocation.operational_point.type === 'uic') {
              requests.push({
                side,
                trainScheduleId: trainSchedule.id,
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

        requests.forEach(({ side, trainScheduleId }, i) => {
          const op = data.related_operational_points[i];
          trainsStationLabels[trainScheduleId] = {
            ...trainsStationLabels[trainScheduleId],
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
  }, [trainScheduleProjections, i18n.language]);

  return { deployedWaypoints, toggleWaypoint, updateTrackOccupanciesOnDrag };
};

export default useTrackOccupancy;
