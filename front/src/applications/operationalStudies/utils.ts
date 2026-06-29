import type { TFunction } from 'i18next';
import { type Dictionary, isEqual } from 'lodash';

import type {
  OperationalPoint,
  OperationalPointReference,
  CorePathfindingResultSuccess,
  PathItemLocation,
  PathProperties,
  RelatedOperationalPoint,
  RoundTrips,
  SimulationResponseSuccess,
  SimulationSummaryResult,
  TrainSchedule,
  ScheduleItem,
  PathItem,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import getPathVoltages from 'modules/pathfinding/helpers/getPathVoltages';
import { isPacedTrain } from 'modules/trainSchedule/helpers/pacedTrain';
import type { SimulationSummary } from 'modules/trainSchedule/types';
import type { TrainScheduleWithPathOps } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { mmToM } from 'utils/physics';
import { SMALL_INPUT_MAX_LENGTH } from 'utils/strings';

import { upsertMapWaypointsInOperationalPoints } from './helpers/upsertMapWaypointsInOperationalPoints';
import type {
  BoundariesData,
  ElectricalBoundariesData,
  ElectricalProfileValue,
  ElectrificationRange,
  ElectrificationUsage,
  ElectrificationValue,
  PathPropertiesFormatted,
  PositionData,
  TrainScheduleRoundTripGroups,
} from './types';

/**
 * The number of stops in the schedule, not counting the one at the origin or destination.
 */
export const intermediateStopsCount = ({
  schedule,
  path,
}: {
  schedule?: ScheduleItem[];
  path: PathItem[];
}) => {
  if (!schedule) return 0;

  const originId = path.at(0)?.id;
  const destinationId = path.at(-1)?.id;
  const intermediateStops = schedule.filter(
    (step) => step.stop_for && step.at !== originId && step.at !== destinationId
  );
  return intermediateStops.length;
};

/**
 * Transform data received with boundaries / values format :
 *  - boundaries : List of `n` boundaries of the ranges. A boundary is a distance
 * from the beginning of the path in mm.
    - values : List of `n+1` values associated to the ranges.
    @returns an array of PositionData with the position in meters and the associated value
    depending on the kind of data provided. As the boundaries don't include the path's origin and destination
    positions, we add them manually.
 */
export const transformBoundariesDataToPositionDataArray = <T extends 'gradient' | 'radius'>(
  boundariesData: BoundariesData,
  pathLength: number,
  value: T
): PositionData<T>[] => {
  const formattedData = boundariesData.boundaries.reduce(
    (acc, boundary, index) => {
      const newData = {
        position: mmToM(boundary),
        [value]: boundariesData.values[index],
      } as PositionData<T>;
      const combiningData = {
        position: mmToM(boundary),
        [value]: boundariesData.values[index + 1],
      } as PositionData<T>;
      acc.push(newData, combiningData);
      return acc;
    },
    [{ position: 0, [value]: 0 }] as PositionData<T>[]
  );

  formattedData.push({
    position: mmToM(pathLength),
    [value]: boundariesData.values[boundariesData.values.length - 1],
  } as PositionData<T>);

  return formattedData;
};

export const mergeElectrificationAndProfiles = (
  electrifications: ElectricalBoundariesData<ElectrificationValue> | null | undefined,
  electricalProfiles: ElectricalBoundariesData<ElectricalProfileValue>
): ElectricalBoundariesData<ElectrificationUsage> | undefined => {
  if (!electrifications) return undefined;

  const mergedBoundaries = [
    ...new Set([...electrifications.boundaries, ...electricalProfiles.boundaries]),
  ].toSorted((a, b) => a - b);

  const mergedValues: ElectrificationUsage[] = [
    { ...electrifications.values[0], ...electricalProfiles.values[0] },
  ];

  let electrificationIndex = 0;
  let profileIndex = 0;

  for (const boundary of mergedBoundaries) {
    while (
      electrificationIndex < electrifications.boundaries.length &&
      electrifications.boundaries[electrificationIndex] <= boundary
    ) {
      electrificationIndex++;
    }
    while (
      profileIndex < electricalProfiles.boundaries.length &&
      electricalProfiles.boundaries[profileIndex] <= boundary
    ) {
      profileIndex++;
    }

    mergedValues.push({
      ...electrifications.values[electrificationIndex],
      ...electricalProfiles.values[profileIndex],
    });
  }

  return { boundaries: mergedBoundaries, values: mergedValues };
};

/**
 * Transform electrifications received with boundaries / values format :
 *  - boundaries : List of `n` boundaries of the ranges. A boundary is a distance
 * from the beginning of the path in mm.
    - values : List of `n+1` values associated to the ranges.
    @returns an array of electrifications ranges with the start and stop of the range in meters and
    the associated value. As the boundaries don't include the path's origin and destination
    positions, we add them manually.
 */
export const transformElectricalBoundariesToRanges = (
  boundariesData: ElectricalBoundariesData<ElectrificationUsage> | undefined,
  pathLength: number
): ElectrificationRange[] => {
  if (!boundariesData) return [];

  const { boundaries, values } = boundariesData;

  const formattedData: ElectrificationRange[] = boundaries.map((boundary, index) => ({
    start: index === 0 ? 0 : mmToM(boundaries[index - 1]),
    stop: mmToM(boundary),
    electrificationUsage: values[index],
  }));

  formattedData.push({
    start: mmToM(boundaries.at(boundaries.length - 1) ?? 0),
    stop: mmToM(pathLength),
    electrificationUsage: values[values.length - 1],
  });

  return formattedData;
};

/**
 * Format path properties data to be used in simulation results charts
 */
export const preparePathPropertiesData = (
  electricalProfiles: SimulationResponseSuccess['electrical_profiles'] | undefined,
  { slopes, curves, electrifications, operational_points, geometry }: PathProperties,
  { path_item_positions, length }: CorePathfindingResultSuccess,
  trainSchedulePath: TrainSchedule['path'],
  t: TFunction<'operational-studies'>
): PathPropertiesFormatted => {
  const formattedSlopes = transformBoundariesDataToPositionDataArray(slopes, length, 'gradient');
  const formattedCurves = transformBoundariesDataToPositionDataArray(curves, length, 'radius');

  const mergedElectrificationAndProfiles = electricalProfiles
    ? mergeElectrificationAndProfiles(electrifications, electricalProfiles)
    : undefined;

  const electrificationAndProfilesRanges = transformElectricalBoundariesToRanges(
    mergedElectrificationAndProfiles,
    length
  );

  const voltageRanges = electricalProfiles ? getPathVoltages(electrifications, length) : [];

  const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
    'EditoastPathOperationalPoint',
    trainSchedulePath,
    path_item_positions,
    operational_points,
    t
  );

  return {
    electrifications: electrificationAndProfilesRanges,
    curves: formattedCurves,
    slopes: formattedSlopes,
    operationalPoints: operationalPointsWithAllWaypoints,
    geometry,
    voltages: voltageRanges,
  };
};

export const isInvalidName = (name?: string | null) =>
  !name || name.length > SMALL_INPUT_MAX_LENGTH;

/**
 * Check if a simulation summary can be considered as simulated.
 * A simulation is considered simulated if it has a valid summary
 * and the schedule was honored (no 'scheduleNotHonored' reason).
 * @param summary - The simulation summary to check
 * @returns true if the simulation is valid and schedule was honored
 */
export const isSimulated = (summary: SimulationSummary | undefined): boolean => {
  if (!summary) return false;
  return summary.isValid && summary.notHonoredReason !== 'scheduleNotHonored';
};

/**
 * Check if the scheduled points are honored with a train schedule summary,
 * meaning that it respects the requested arrival time at scheduled steps (steps with an arrival time set)
 * @param trainScheduleSummary
 * @returns true if the scheduled points are not honored
 */
export const isScheduledPointsNotHonored = (
  trainScheduleSummary: Extract<SimulationSummaryResult, { status: 'success' }>
): boolean => trainScheduleSummary.path_item_respect_times.some((respected) => !respected);

export const getPathItemByIndexDict = (trainSchedule: TrainScheduleResponse) =>
  trainSchedule.path.reduce((acc, pathItem, index) => {
    acc[pathItem.id] = index;
    return acc;
  }, {} as Dictionary<number>);

/**
 * Check if the train is too fast with a train schedule and a train schedule summary,
 * meaning that it does not respect the requested margin between at least 2 scheduled steps (steps with an arrival time or a margin set)
 * @param trainSchedule
 * @param trainScheduleSummary
 * @returns true if the train is too fast
 */
export const isTooFast = (
  trainScheduleSummary: Extract<SimulationSummaryResult, { status: 'success' }>
): boolean => trainScheduleSummary.path_item_respect_margins.some((respected) => !respected);

/**
 * Get a list of unique OP references from train schedules paths.
 */
export const getUniqueOpRefsFromTrainSchedules = (
  trainSchedules: TrainScheduleResponse[]
): OperationalPointReference[] => {
  const pathItems = trainSchedules.flatMap((trainSchedule) => trainSchedule.path);
  const uniqueSteps = new Map<string, OperationalPointReference>();
  for (const pathItem of pathItems) {
    const pathItemLocation = pathItem.location;
    if (pathItemLocation.type === 'track_offset') continue;
    uniqueSteps.set(
      JSON.stringify(pathItemLocation.operational_point),
      pathItemLocation.operational_point
    );
  }
  return [...uniqueSteps.values()];
};

/**
 * Attach OPs to train schedules, given a list of OP references and their
 * matchAllOperationalPoints response.
 */
export const addPathOpsToTrainSchedules = (
  trainSchedules: TrainScheduleResponse[],
  timetableOpRefs: OperationalPointReference[],
  timetableOperationalPoints: (RelatedOperationalPoint | null)[]
): TrainScheduleWithPathOps[] => {
  if (timetableOpRefs.length !== timetableOperationalPoints.length) {
    throw new Error('Expected as many OP match lists as OP refs');
  }

  // Map each operational point reference (path step) to its corresponding operational point
  const opsByKey = new Map<string, RelatedOperationalPoint | null>();
  timetableOperationalPoints.forEach((op, i) => {
    const key = JSON.stringify(timetableOpRefs[i]);
    opsByKey.set(key, op);
  });

  // For each train schedule, fill the pathOps property with
  // their corresponding operational points
  return trainSchedules.map((trainSchedule) => {
    // For each pathStepKeys, find its corresponding operational points :
    // 1. if found, return the operational points
    // 2. if key exists but no operational points were found, return null
    // 3. if key does not exist in opsByKey (meaning it's a track offset), return null
    const pathOps = trainSchedule.path.map((pathItem) => {
      if (pathItem.location.type === 'track_offset') return null;
      return opsByKey.get(JSON.stringify(pathItem.location.operational_point)) ?? null;
    });
    return { ...trainSchedule, pathOps };
  });
};

/**
 * Check whether a train schedule can be seen as the return of another
 * train schedule. If this function returns true, we can draw a single line to
 * represent the round-trip in the macro editor.
 */
export const checkRoundTripCompatible = (
  trainScheduleA: TrainScheduleWithPathOps,
  trainScheduleB: TrainScheduleWithPathOps
): boolean => {
  if (isPacedTrain(trainScheduleA) !== isPacedTrain(trainScheduleB)) {
    return false;
  }
  if (
    isPacedTrain(trainScheduleA) &&
    isPacedTrain(trainScheduleB) &&
    Duration.parse(trainScheduleA.paced.interval).ms !==
      Duration.parse(trainScheduleB.paced.interval).ms
  ) {
    return false;
  }
  if (!isEqual(trainScheduleA.category, trainScheduleB.category)) {
    return false;
  }
  if (trainScheduleA.pathOps.length !== trainScheduleB.pathOps.length) {
    return false;
  }

  // local_track_name is ignored because we don't want to take tracks into account
  // Only take into account uic/trigram/opId of the path items
  const stripLocationLocalTrackName = (location: PathItemLocation) => {
    if (location.type !== 'operational_point_part_reference') return location;
    const { local_track_name: _, ...rest } = location;
    return rest;
  };

  for (const [indexA, opA] of trainScheduleA.pathOps.entries()) {
    const indexB = trainScheduleA.pathOps.length - indexA - 1;
    const opB = trainScheduleB.pathOps[indexB];

    const pathItemA = trainScheduleA.path[indexA];
    const pathItemB = trainScheduleB.path[indexB];

    if (opA?.id !== opB?.id) {
      return false;
    }
    if (!opA || !opB) {
      if (
        !isEqual(
          stripLocationLocalTrackName(pathItemA.location),
          stripLocationLocalTrackName(pathItemB.location)
        )
      ) {
        return false;
      }
    }

    const scheduleItemA = trainScheduleA.schedule?.find(({ at }) => at === pathItemA.id);
    const scheduleItemB = trainScheduleB.schedule?.find(({ at }) => at === pathItemB.id);

    const isStopA = indexA === 0 || Boolean(scheduleItemA?.stop_for);
    const isStopB = indexB === 0 || Boolean(scheduleItemB?.stop_for);
    if (isStopA !== isStopB) {
      return false;
    }
  }

  return true;
};

/**
 * Group train schedules in three columns: one-ways, round-trips and others.
 */
export const groupRoundTrips = (
  trainSchedulesById: Map<number, TrainScheduleWithPathOps>,
  rawRoundTrips?: RoundTrips
): TrainScheduleRoundTripGroups => {
  const oneWayIds = rawRoundTrips?.one_ways ?? [];
  const roundTripIds = rawRoundTrips?.round_trips ?? [];

  const oneWays = oneWayIds.map((id) => trainSchedulesById.get(id)!);
  const roundTrips = roundTripIds.map(
    ([leftId, rightId]) =>
      [trainSchedulesById.get(leftId)!, trainSchedulesById.get(rightId)!] as const
  );

  const oneWayOrRoundTripIds = new Set<number>([...oneWayIds, ...roundTripIds.flat()]);
  const others = [...trainSchedulesById.values()].filter(
    (trainSchedule) => !oneWayOrRoundTripIds.has(trainSchedule.id)
  );

  return { oneWays, roundTrips, others };
};

export const getInvalidStepLabel = (opRef: OperationalPointReference) => {
  if (opRef.type === 'uic') return opRef.uic.toString();
  if (opRef.type === 'trigram') return opRef.trigram;
  return opRef.operational_point;
};

export const matchOpRefAndOp = (
  location: PathItemLocation,
  op: PathProperties['operational_points'][number] | OperationalPoint
) => {
  if (location.type === 'track_offset') return false;

  if (location.operational_point.type === 'id') {
    return location.operational_point.operational_point === op.id;
  }
  if (location.operational_point.type === 'uic') {
    return (
      location.operational_point.uic === op.uic &&
      location.operational_point.secondary_code === op.secondary_code
    );
  }
  return (
    location.operational_point.trigram === op.main_code &&
    location.operational_point.secondary_code === op.secondary_code
  );
};
