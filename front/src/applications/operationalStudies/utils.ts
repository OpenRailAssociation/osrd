import type { TFunction } from 'i18next';
import { type Dictionary, isEqual } from 'lodash';

import type {
  OperationalPoint,
  OperationalPointReference,
  PathfindingResultSuccess,
  PathItemLocation,
  PathProperties,
  RelatedOperationalPoint,
  RoundTrips,
  SimulationResponseSuccess,
  SimulationSummaryResult,
  TrainSchedule,
} from 'common/api/osrdEditoastApi';
import getPathVoltages from 'modules/pathfinding/helpers/getPathVoltages';
import { ARRIVAL_TIME_ACCEPTABLE_ERROR } from 'modules/timesStops/consts';
import type {
  TimetableItem,
  TimetableItemId,
  TimetableItemWithPathOps,
} from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { mmToM } from 'utils/physics';
import { SMALL_INPUT_MAX_LENGTH } from 'utils/strings';
import {
  formatEditoastIdToPacedTrainId,
  formatEditoastIdToTrainScheduleId,
  isPacedTrainResponseWithPacedTrainId,
} from 'utils/trainId';

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
  TimetableItemRoundTripGroups,
} from './types';

/**
 * Transform datas received with boundaries / values format :
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
  electricalProfiles: SimulationResponseSuccess['electrical_profiles'],
  { slopes, curves, electrifications, operational_points, geometry }: PathProperties,
  { path_item_positions, length }: PathfindingResultSuccess,
  trainSchedulePath: TrainSchedule['path'],
  t: TFunction<'operational-studies'>
): PathPropertiesFormatted => {
  const formattedSlopes = transformBoundariesDataToPositionDataArray(slopes, length, 'gradient');
  const formattedCurves = transformBoundariesDataToPositionDataArray(curves, length, 'radius');

  const mergedElectrificationAndProfiles = mergeElectrificationAndProfiles(
    electrifications,
    electricalProfiles
  );

  const electrificationAndProfilesRanges = transformElectricalBoundariesToRanges(
    mergedElectrificationAndProfiles,
    length
  );

  const voltageRanges = getPathVoltages(electrifications, length);

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
 * Check if the scheduled points are honored with a timetable item and a timetable item summary
 * @param timetableItem
 * @param timetableItemSummary
 * @returns true if the scheduled points are not honored
 */
export const isScheduledPointsNotHonored = (
  timetableItem: TimetableItem,
  timetableItemSummary: Extract<SimulationSummaryResult, { status: 'success' }>
): boolean => {
  if (timetableItemSummary.path_item_times_final.length !== timetableItem.path.length) {
    console.error(
      'The number of path_item_times_final does not match the number of paths in the schedule'
    );
    throw new Error('Assertion failed');
  }

  if (!timetableItem.schedule) return false;

  const pathItemIndexById = new Map<string, number>();
  timetableItem.path.forEach((pathItem, index) => {
    pathItemIndexById.set(pathItem.id, index);
  });
  return timetableItem.schedule.some((schedule) => {
    if (!schedule.arrival) return false;
    const matchindIndex = pathItemIndexById.get(schedule.at);
    if (!matchindIndex) {
      throw new Error(
        `No matching index found for schedule ${schedule} on timetableItem ${timetableItem}`
      );
    }
    const arrival = Duration.parse(schedule.arrival);
    return (
      Math.abs(arrival.ms - timetableItemSummary.path_item_times_final[matchindIndex]) >=
      ARRIVAL_TIME_ACCEPTABLE_ERROR.ms
    );
  });
};

export const getPathItemByIndexDict = (timetableItemResult: TimetableItem) =>
  timetableItemResult.path.reduce((acc, pathItem, index) => {
    acc[pathItem.id] = index;
    return acc;
  }, {} as Dictionary<number>);

/**
 * Check if the item is too fast with a timetable item and a timetable item summary,
 * meaning that it does not respect the requested margin between at least 2 scheduled steps (steps with an arrival time or a margin set)
 * @param timetableItem
 * @param timetableItemSummary
 * @returns true if the train is too fast
 */
export const isTooFast = (
  timetableItem: TimetableItem,
  timetableItemSummary: Extract<SimulationSummaryResult, { status: 'success' }>
): boolean => {
  if (
    timetableItemSummary.path_item_times_final.length !==
    timetableItemSummary.path_item_times_provisional.length
  ) {
    throw new Error('Assertion failed');
  }

  const marginBoundariesSet = new Set(timetableItem.margins?.boundaries);
  const toCheckPathItemIds: string[] = [];
  timetableItem.schedule?.forEach((schedule, i) => {
    if (!i || schedule.arrival || marginBoundariesSet.has(schedule.at)) {
      toCheckPathItemIds.push(schedule.at);
    }
  });
  const lastStepId = timetableItem.path[timetableItem.path.length - 1].id;
  if (toCheckPathItemIds[toCheckPathItemIds.length - 1] !== lastStepId)
    toCheckPathItemIds.push(lastStepId);

  const pathItemMap = getPathItemByIndexDict(timetableItem);

  for (let j = 0; j < toCheckPathItemIds.length; j++) {
    const pathItemId = toCheckPathItemIds[j];
    const pathItemIndex = pathItemMap[pathItemId];
    const pathItemTimeFinal = timetableItemSummary.path_item_times_final[pathItemIndex];
    const pathItemTimeProvisional = timetableItemSummary.path_item_times_provisional[pathItemIndex];

    const prevPathItemId = j ? toCheckPathItemIds[j - 1] : timetableItem.path[0].id;
    const prevPathItemIndex = pathItemMap[prevPathItemId];
    const prevPathItemTimeFinal = timetableItemSummary.path_item_times_final[prevPathItemIndex];
    const prevPathItemTimeProvisional =
      timetableItemSummary.path_item_times_provisional[prevPathItemIndex];

    const intervalDurationFinal = pathItemTimeFinal - prevPathItemTimeFinal;
    const intervalDurationProvisional = pathItemTimeProvisional - prevPathItemTimeProvisional;
    const marginDiff = intervalDurationFinal - intervalDurationProvisional;

    if (marginDiff < -ARRIVAL_TIME_ACCEPTABLE_ERROR.ms) {
      return true;
    }
  }
  return false;
};

export const isOperationalPointReference = (
  pathItemLocation: PathItemLocation
): pathItemLocation is OperationalPointReference => {
  if ('track' in pathItemLocation) return false;
  // Returning just `!('track' in pathItemLocation)` won't guarantee that the param is an OperationPointReference
  // if in the future PathItemLocation is extended like `PathItemLocation = TrackOffset | OperationalPointReference | IntlOp;`.
  // The following line ensures that if later PathItemLocation is extended, Typescript will show an error
  // making the CI fail so we can update this util accordingly.
  pathItemLocation satisfies OperationalPointReference;

  return true;
};

export const getStationFromOps = (ops: OperationalPoint[]): OperationalPoint | undefined =>
  ops.find((op) => ['BV', '00'].includes(op.extensions?.sncf?.ch || '')) || ops.at(0);

/**
 * Get a path item location (without ID and deleted fields) from a train's path
 * item.
 */
const getPathItemLocation = (pathItem: TrainSchedule['path'][number]) => {
  const { id: _id, deleted: _deleted, ...pathItemLocation } = pathItem;
  return pathItemLocation;
};

/**
 * Get a list of unique OP references from timetable items paths.
 */
export const getUniqueOpRefsFromTimetableItems = (
  timetableItems: TimetableItem[]
): OperationalPointReference[] => {
  const pathItems = timetableItems.flatMap((timetableItem) => timetableItem.path);
  const uniqueSteps = new Map<string, OperationalPointReference>();
  for (const pathItem of pathItems) {
    const pathItemLocation = getPathItemLocation(pathItem);
    if (!isOperationalPointReference(pathItemLocation)) continue;
    uniqueSteps.set(JSON.stringify(pathItemLocation), pathItemLocation);
  }
  return [...uniqueSteps.values()];
};

/**
 * Attach OPs to timetable items, given a list of OP references and their
 * matchAllOperationalPoints response.
 */
export const addPathOpsToTimetableItems = (
  timetableItems: TimetableItem[],
  timetableOpRefs: OperationalPointReference[],
  timetableOperationalPoints: RelatedOperationalPoint[][]
): TimetableItemWithPathOps[] => {
  if (timetableOpRefs.length !== timetableOperationalPoints.length) {
    throw new Error('Expected as many OP match lists as OP refs');
  }

  // Map each operational point reference (path step) to its corresponding operational points
  const opsByKey = new Map<string, RelatedOperationalPoint[]>();
  timetableOperationalPoints.forEach((ops, i) => {
    const key = JSON.stringify(timetableOpRefs[i]);
    opsByKey.set(key, ops);
  });

  // For each timetable item, fill the pathOps property with
  // their corresponding operational points
  return timetableItems.map((timetableItem) => {
    // For each pathStepKeys, find its corresponding operational points :
    // 1. if found, return the operational points
    // 2. if key exists but no operational points were found, return an empty array
    // 3. if key does not exist in opsByKey (meaning it's a track offset), return an empty array
    const pathOps = timetableItem.path.map(
      (pathItem) => opsByKey.get(JSON.stringify(getPathItemLocation(pathItem))) ?? []
    );
    return { ...timetableItem, pathOps };
  });
};

/**
 * Check whether a timetable item can be seen as the return of another
 * timetable item. If this function returns true, we can draw a single line to
 * represent the round-trip in the macro editor.
 */
export const checkRoundTripCompatible = (
  timetableItemA: TimetableItemWithPathOps,
  timetableItemB: TimetableItemWithPathOps
): boolean => {
  if (
    isPacedTrainResponseWithPacedTrainId(timetableItemA) !==
    isPacedTrainResponseWithPacedTrainId(timetableItemB)
  ) {
    return false;
  }
  if (
    isPacedTrainResponseWithPacedTrainId(timetableItemA) &&
    isPacedTrainResponseWithPacedTrainId(timetableItemB) &&
    Duration.parse(timetableItemA.paced.interval).ms !==
      Duration.parse(timetableItemB.paced.interval).ms
  ) {
    return false;
  }
  if (!isEqual(timetableItemA.category, timetableItemB.category)) {
    return false;
  }
  if (timetableItemA.pathOps.length !== timetableItemB.pathOps.length) {
    return false;
  }

  for (const [indexA, opsA] of timetableItemA.pathOps.entries()) {
    const indexB = timetableItemA.pathOps.length - indexA - 1;
    const opsB = timetableItemB.pathOps[indexB];

    const pathItemA = timetableItemA.path[indexA];
    const pathItemB = timetableItemB.path[indexB];

    const aExists = opsA.length > 0;
    const bExists = opsB.length > 0;
    if (aExists !== bExists) {
      return false;
    }
    if (aExists && bExists) {
      const stationA = getStationFromOps(opsA)!;
      const stationB = getStationFromOps(opsB)!;
      if (stationA.id !== stationB.id) {
        return false;
      }
    } else {
      // id is specific to each timetable item
      // track_reference is ignored because we don't want to take tracks into account
      // Only take into account uic/trigram/opId of the path items
      const opRefA = {
        ...pathItemA,
        id: undefined,
        deleted: undefined,
        track_reference: undefined,
      };
      const opRefB = {
        ...pathItemB,
        id: undefined,
        deleted: undefined,
        track_reference: undefined,
      };

      if (!isEqual(opRefA, opRefB)) {
        return false;
      }
    }

    const scheduleItemA = timetableItemA.schedule?.find(({ at }) => at === pathItemA.id);
    const scheduleItemB = timetableItemB.schedule?.find(({ at }) => at === pathItemB.id);

    const isStopA = indexA === 0 || Boolean(scheduleItemA?.stop_for);
    const isStopB = indexB === 0 || Boolean(scheduleItemB?.stop_for);
    if (isStopA !== isStopB) {
      return false;
    }
  }

  return true;
};

/**
 * Group timetable items in three columns: one-ways, round-trips and others.
 */
export const groupRoundTrips = (
  timetableItemsById: Map<TimetableItemId, TimetableItemWithPathOps>,
  rawRoundTrips: { trainSchedules: RoundTrips; pacedTrains: RoundTrips }
): TimetableItemRoundTripGroups => {
  const oneWayIds = [
    ...(rawRoundTrips.trainSchedules.one_ways ?? []).map(formatEditoastIdToTrainScheduleId),
    ...(rawRoundTrips.pacedTrains.one_ways ?? []).map(formatEditoastIdToPacedTrainId),
  ];
  const roundTripIds = [
    ...(rawRoundTrips.trainSchedules.round_trips ?? []).map(
      ([leftId, rightId]) =>
        [
          formatEditoastIdToTrainScheduleId(leftId),
          formatEditoastIdToTrainScheduleId(rightId),
        ] as const
    ),
    ...(rawRoundTrips.pacedTrains.round_trips ?? []).map(
      ([leftId, rightId]) =>
        [formatEditoastIdToPacedTrainId(leftId), formatEditoastIdToPacedTrainId(rightId)] as const
    ),
  ];

  const oneWays = oneWayIds.map((id) => timetableItemsById.get(id)!);
  const roundTrips = roundTripIds.map(
    ([leftId, rightId]) =>
      [timetableItemsById.get(leftId)!, timetableItemsById.get(rightId)!] as const
  );

  const oneWayOrRoundTripIds = new Set<TimetableItemId>([...oneWayIds, ...roundTripIds.flat()]);
  const others = [...timetableItemsById.values()].filter(
    (timetableItem) => !oneWayOrRoundTripIds.has(timetableItem.id)
  );

  return { oneWays, roundTrips, others };
};

export const getInvalidStepLabel = (step: OperationalPointReference) => {
  if ('uic' in step) return step.uic.toString();
  if ('trigram' in step) return step.trigram;
  return step.operational_point;
};

export const matchOpRefAndOp = (
  location: PathItemLocation,
  op: PathProperties['operational_points'][number] | OperationalPoint
) => {
  if ('operational_point' in location) {
    return location.operational_point === op.id;
  }
  if ('uic' in location) {
    return (
      location.uic === op.extensions?.identifier?.uic &&
      location.secondary_code === op.extensions?.sncf?.ch
    );
  }
  if ('trigram' in location) {
    return (
      location.trigram === op.extensions?.sncf?.trigram &&
      location.secondary_code === op.extensions?.sncf?.ch
    );
  }
  return false;
};
