import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { OccupancyZone, Track } from '@osrd-project/ui-charts';
import type { TFunction } from 'i18next';
import { forEach, fromPairs, isEmpty, isEqual, isFunction, keyBy, noop } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { type OperationalPointReference, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import { computeIndexedOccurrenceStartTime } from 'modules/timetableItem/helpers/pacedTrain';
import type { SimulatedException } from 'modules/timetableItem/types';
import type { TimetableItemId, TrainId } from 'reducers/osrdconf/types';
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
 * The synthetic track ID used for occupancy zones whose local_track_name is null.
 * Displayed at the very end of the track list.
 */
const NULL_TRACK_ID = '[ ]';

/**
 * Information about tracks for a given operational point (keyed by opId).
 *
 * - `tracks`: Ordered list of tracks derived from `match_operational_points` results.
 *   Each track uses its `local_track_name` as `Track.id` and `Track.name`.
 * - `sectionIdToLocalName`: Reverse-lookup map from track-section ID → local_track_name,
 *   used to resolve `track_id` references from `track_occupancy` back to a local_track_name.
 */
type TrackInfo = {
  tracks: Track[];
  sectionIdToLocalName: Map<string, string>;
};

/**
 * Given the base ordered tracks (from match_operational_points), path item tracks, and zones for a waypoint,
 * compute the full ordered track list:
 *  1. All base tracks in order
 *  2. Any path item local_track_name values not in base list
 *  3. Any extra tracks referenced by zones but not in the base list (appended after)
 *  4. The NULL_TRACK_ID track last (only if no base tracks and no zones)
 */
function mergeTracksWithZones(
  baseTracks: Track[],
  zones: MovableOccupancyZone[] | undefined,
  pathTracks: string[] = []
): Track[] {
  // If no base tracks AND no zones AND no path tracks, return fallback track
  if (baseTracks.length === 0 && !zones?.length && pathTracks.length === 0) {
    return [{ id: NULL_TRACK_ID, name: NULL_TRACK_ID }];
  }

  if (!zones?.length && pathTracks.length === 0) return baseTracks;

  const baseTrackIds = new Set(baseTracks.map((t) => t.id));
  const pathTrackSet = new Set(pathTracks);
  const extraTracks: Track[] = [];
  let hasNullTrack = false;

  for (const pathTrack of pathTracks) {
    if (!baseTrackIds.has(pathTrack) && !extraTracks.some((t) => t.id === pathTrack)) {
      extraTracks.push({ id: pathTrack, name: pathTrack });
    }
  }

  for (const zone of zones || []) {
    if (zone.trackId === NULL_TRACK_ID) {
      hasNullTrack = true;
    } else if (
      !baseTrackIds.has(zone.trackId) &&
      !pathTrackSet.has(zone.trackId) &&
      !extraTracks.some((t) => t.id === zone.trackId)
    ) {
      extraTracks.push({ id: zone.trackId, name: zone.trackId });
    }
  }

  const result = [...baseTracks, ...extraTracks];
  if (hasNullTrack && !baseTrackIds.has(NULL_TRACK_ID)) {
    result.push({ id: NULL_TRACK_ID, name: NULL_TRACK_ID });
  }
  return result;
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
 * - updateTrackOccupanciesOnDrag:
 *   A function to call when a train is dragged in the SpaceTimeChart, so that its related
 *   occupancy zones are updated accordingly
 */
const useTrackOccupancy = ({
  infraId,
  timetableItemProjections,
  pathOperationalPoints,
  timetableItemsWithDetails = [],
  pathItems = [],
}: {
  infraId: number;
  timetableItemProjections: TrainSpaceTimeData[];
  pathOperationalPoints: PathOperationalPoint[];
  timetableItemsWithDetails?: Array<{
    id: string;
    path?: Array<{
      id?: string;
      location?: {
        operational_point?: { trigram?: string; uic?: number };
        local_track_name?: string | null;
      };
    }>;
  }>;
  pathItems?: Array<{
    location?: { operational_point?: { trigram?: string }; local_track_name?: string | null };
  }>;
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

  const [postPacedTrainTrackOccupancy] =
    osrdEditoastApi.endpoints.postPacedTrainTrackOccupancy.useMutation();
  const isSimulationEnabled = useSelector(getIsSimulationEnabled);
  const [postInfraByInfraIdMatchOperationalPoints] =
    osrdEditoastApi.endpoints.postInfraByInfraIdMatchOperationalPoints.useLazyQuery();
  const timetableItemProjectionsById: Map<TimetableItemId, TrainSpaceTimeData> = useMemo(
    () => new Map(timetableItemProjections.map((item) => [item.id, item])),
    [timetableItemProjections]
  );
  /**
   * Tracks keyed by opId. Each entry holds:
   * - `tracks`: ordered list using local_track_name as Track.id/name
   * - `sectionIdToLocalName`: reverse map for resolving track_id refs from track_occupancy
   *
   * Initialized as 'ok' (empty) so that deployedWaypoints is never permanently blocked
   * when no waypoints have an opId (which would leave it in 'loading' forever).
   */
  const [tracksState, setTracksState] = useState<AsyncState<Record<string, TrackInfo>>>({
    type: 'ok',
    data: {},
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
    !isOccurrenceId(id) ? id : extractPacedTrainIdFromOccurrenceId(id);

  /** Return the TrackInfo for an opId, used to resolve zone trackIds. */
  const getTrackInfo = useCallback(
    (opId: string | null | undefined): TrackInfo | undefined => {
      if (!opId) return undefined;
      return tracksState.data?.[opId];
    },
    [tracksState]
  );

  const fetchTrackOccupancy = useCallback(
    async (
      opRef: OperationalPointReference | undefined | null,
      trainsCollection: Record<TimetableItemId, TrainSpaceTimeData>,
      trackInfo?: TrackInfo
    ): Promise<MovableOccupancyZone[]> => {
      if (!opRef) return [];

      const trainIds = Object.keys(trainsCollection) as TimetableItemId[];

      if (trainIds.length === 0) return [];

      const bodyForPaced = {
        operational_point_reference: opRef,
        infra_id: infraId,
        paced_train_ids: trainIds.map(extractEditoastIdFromPacedTrainId),
        use_simulation: isSimulationEnabled,
      };

      try {
        const pacedResp = await postPacedTrainTrackOccupancy({ body: bodyForPaced });

        const zones: MovableOccupancyZone[] = [];

        if (pacedResp?.data) {
          for (const trackItem of pacedResp.data) {
            const { local_track_name: localTrackName, trains } = trackItem;
            // Resolve trackId: use local_track_name directly as the track ID
            // (tracks are keyed by local_track_name in tracksState).
            // Fall back to NULL_TRACK_ID when local_track_name is absent.
            const zoneTrackId = localTrackName ?? NULL_TRACK_ID;

            // If the OP has a known track list, skip zones for tracks not in it
            // (they will be appended via mergeTracksWithZones in deployedWaypoints).

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
                    zoneTrackId,
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
                exceptionProjection = train.paced.exceptionProjections.get(
                  occupation.exception_key
                );
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
                  exception?.train_name?.value ??
                  computeOccurrenceName(train.name, occupation.index);

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
                  zoneTrackId,
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
      } catch (error: unknown) {
        // If the API returns 404 (train not found), it means the train was deleted
        // Gracefully return empty zones instead of propagating the error
        const apiError = error as { status?: number };
        if (apiError?.status === 404) {
          console.debug('Train not found for track occupancy (likely deleted):', error);
          return [];
        }
        // Re-throw other errors
        throw error;
      }
    },
    [infraId, postPacedTrainTrackOccupancy, isSimulationEnabled]
  );

  const deployedWaypoints = useMemo(() => {
    const res: DeployedWaypoint[] = [];

    if (tracksState.type === 'ok')
      forEach(pathOperationalPointsState, (opState, waypointId) => {
        const op = pathOpsByWaypointId.get(waypointId);
        // Allow any waypoint that has a resolvable OP reference (opId, trigram, or UIC),
        // including those with opId=null (e.g. trains with invalid pathfinding).
        const hasReference = op != null && getOperationalPointReference(op) !== undefined;
        if (opState.selected && hasReference && op != null) {
          const trackInfo = op.opId ? tracksState.data[op.opId] : undefined;
          const baseTracks = trackInfo?.tracks ?? [];

          // Extract local_track_name values from all trains' paths for this OP.
          // Trains may identify the same OP differently:
          //   1. By waypointId (path item id): computed trains whose path items are UUIDs
          //   2. By trigram: uncomputed trains that identify OPs by trigram
          //   3. By UIC: uncomputed trains that identify OPs by UIC code
          const pathTracksForOp = new Set<string>();
          const opTrigram = op.extensions?.sncf?.trigram;
          const opUIC = op.extensions?.identifier?.uic;

          for (const trainWithDetails of timetableItemsWithDetails) {
            if (!trainWithDetails.path) continue;
            for (const pathItem of trainWithDetails.path) {
              if (!pathItem.location) continue;
              const itemOp = pathItem.location.operational_point;
              const itemLocalTrack = pathItem.location.local_track_name;

              const matchesWaypointId = pathItem.id === waypointId;
              const matchesTrigram =
                opTrigram != null && itemOp && 'trigram' in itemOp && itemOp.trigram === opTrigram;
              const matchesUIC = opUIC != null && itemOp && 'uic' in itemOp && itemOp.uic === opUIC;

              if (matchesWaypointId || matchesTrigram || matchesUIC) {
                pathTracksForOp.add(itemLocalTrack ?? NULL_TRACK_ID);
              }
            }
          }

          // Also check pathItems for backward compatibility
          pathItems.forEach((item) => {
            const itemOp = item.location?.operational_point;
            const itemLocalTrack = item.location?.local_track_name;
            const matchesTrigram =
              opTrigram != null && itemOp && 'trigram' in itemOp && itemOp.trigram === opTrigram;
            const matchesUIC = opUIC != null && itemOp && 'uic' in itemOp && itemOp.uic === opUIC;
            if (matchesTrigram || matchesUIC) {
              pathTracksForOp.add(itemLocalTrack ?? NULL_TRACK_ID);
            }
          });

          const tracks = mergeTracksWithZones(
            baseTracks,
            opState.zones.data,
            Array.from(pathTracksForOp)
          );

          res.push({
            waypointId,
            // Use opId when available, fall back to waypointId so the required string field is always set
            operationalPointId: op.opId ?? waypointId,
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
  }, [
    pathOperationalPointsState,
    pathOpsByWaypointId,
    tracksState,
    t,
    pathItems,
    timetableItemProjections,
    timetableItemsWithDetails,
  ]);

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
        const trackInfo = getTrackInfo(waypoint.opId);
        const abort = batchFetchTrackOccupancy(
          Array.from(timetableItemProjectionsById.keys()),
          (ids) =>
            fetchTrackOccupancy(
              getOperationalPointReference(waypoint),
              Object.fromEntries(ids.map((id) => [id, timetableItemProjectionsById.get(id)!])),
              trackInfo
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
          const trackInfo = getTrackInfo(waypoint.opId);

          fetchTrackOccupancy(opRef, trains, trackInfo).then((newZones) => {
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
      getTrackInfo,
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
            const waypoint = pathOpsByWaypointId.get(waypointId);
            const trackInfo = getTrackInfo(waypoint?.opId);
            const newZones = await fetchTrackOccupancy(
              getOperationalPointReference(waypoint),
              {
                [draggedTrainEditoastId]: newTrainData,
              },
              trackInfo
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
    [pathOpsByWaypointId, pathOperationalPointsState, getTrackInfo]
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
      (op) => !(tracksState.data || {})[op.opId ?? '']
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

        // Collect all track section IDs that need metadata (only for OPs that exist):
        const allTrackIds = data.related_operational_points.flatMap((opMatches) => {
          const op = opMatches[0];
          return op ? op.parts.map((part) => part.track) : [];
        });
        const fetchedTrackSections = await getTrackSectionsByIds(allTrackIds);

        const trackSectionByTrackId = new Map<string, (typeof fetchedTrackSections)[string]>();
        for (const trackSection of Object.values(fetchedTrackSections)) {
          if (trackSection.id) trackSectionByTrackId.set(trackSection.id, trackSection);
        }

        const loadedTrackInfos = fromPairs(
          operationalPointReferences.map(({ operational_point }, i) => {
            const opMatches = data.related_operational_points[i];
            const op = opMatches?.[0];

            if (!op) {
              // OP not found in infra → do nothing (tracks list stays empty)
              return [operational_point, null];
            }

            // Build ordered tracks using local_track_name as ID.
            // Deduplicate by local_track_name (preserve first-occurrence order).
            const seen = new Set<string>();
            const tracks: Track[] = [];
            const sectionIdToLocalName = new Map<string, string>();

            for (const part of op.parts) {
              const { local_track_name, track } = part;
              const trackPart = trackSectionByTrackId.get(track);

              // Build reverse map: section_id → local_track_name
              sectionIdToLocalName.set(track, local_track_name);

              if (!seen.has(local_track_name)) {
                seen.add(local_track_name);
                tracks.push({
                  id: local_track_name,
                  name: local_track_name,
                  line:
                    trackPart?.extensions?.sncf?.line_code != null
                      ? String(trackPart.extensions.sncf.line_code)
                      : undefined,
                });
              }
            }

            const trackInfo: TrackInfo = { tracks, sectionIdToLocalName };
            return [operational_point, trackInfo];
          })
        );

        const validTrackInfos = Object.entries(loadedTrackInfos).filter(
          (entry): entry is [string, TrackInfo] => entry[1] !== null
        );
        setTracksState((state) => ({
          type: 'ok',
          // Merge previously loaded infos with newly loaded ones (skip null entries = OP not found)
          data: {
            ...(state.data || {}),
            ...Object.fromEntries(validTrackInfos),
          },
        }));
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
  }, [pathOperationalPoints]);

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
        const waypoint = pathOpsByWaypointId.get(waypointId);
        const trackInfo = getTrackInfo(waypoint?.opId);

        // Only fetch for trains that still exist in the current projection
        const trainsToFetch = Object.fromEntries(
          [...addedTrainIDs, ...modifiedTrainIDs]
            .filter((id) => timetableItemProjectionsById.has(id))
            .map((id) => [id, timetableItemProjectionsById.get(id)!])
        );

        if (Object.keys(trainsToFetch).length === 0) return;

        const newZones = await fetchTrackOccupancy(
          getOperationalPointReference(waypoint),
          trainsToFetch,
          trackInfo
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
