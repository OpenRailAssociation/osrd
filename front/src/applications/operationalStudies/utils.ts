import type { TFunction } from 'i18next';
import type { Dictionary } from 'lodash';

import type {
  PathfindingResultSuccess,
  PathProperties,
  SimulationSummaryResult,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import getPathVoltages from 'modules/pathfinding/helpers/getPathVoltages';
import { ARRIVAL_TIME_ACCEPTABLE_ERROR_MS } from 'modules/timesStops/consts';
import { convertUTCDateToLocalDate, isoDateToMs } from 'utils/date';
import { Duration } from 'utils/duration';
import { mmToM } from 'utils/physics';
import { SMALL_INPUT_MAX_LENGTH } from 'utils/strings';
import { ms2sec } from 'utils/timeManipulation';

import { upsertMapWaypointsInOperationalPoints } from './helpers/upsertMapWaypointsInOperationalPoints';
import type {
  BoundariesData,
  ElectricalBoundariesData,
  ElectricalProfileValue,
  ElectricalRangesData,
  ElectrificationRange,
  ElectrificationValue,
  PathPropertiesFormatted,
  PositionData,
  SimulationResponseSuccess,
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
  const formatedData = boundariesData.boundaries.reduce(
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

  formatedData.push({
    position: mmToM(pathLength),
    [value]: boundariesData.values[boundariesData.values.length - 1],
  } as PositionData<T>);

  return formatedData;
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
export const transformBoundariesDataToRangesData = <
  T extends ElectrificationValue | ElectricalProfileValue,
>(
  boundariesData: ElectricalBoundariesData<T>,
  pathLength: number
): ElectricalRangesData<T>[] => {
  // TODO : remove electrical profiles
  const formatedData = boundariesData.boundaries.map((boundary, index) => ({
    start: index === 0 ? 0 : mmToM(boundariesData.boundaries[index - 1]),
    stop: mmToM(boundary),
    values: boundariesData.values[index],
  }));

  formatedData.push({
    start:
      boundariesData.boundaries.length === 0
        ? 0
        : mmToM(boundariesData.boundaries[boundariesData.boundaries.length - 1]),
    stop: mmToM(pathLength),
    values: boundariesData.values[boundariesData.values.length - 1],
  });

  return formatedData;
};

export const formatElectrificationRanges = (
  electrifications: ElectricalRangesData<ElectrificationValue>[],
  electricalProfiles: ElectricalRangesData<ElectricalProfileValue>[]
): ElectrificationRange[] =>
  // Electrifications can be of three types, electricalProfiles only two, so we know electrifications
  // will always be at least as long as electricalProfiles so we can use it as the main array
  electrifications.map((currentElectrification, index) => {
    const currentProfile = electricalProfiles[index];

    // currentProfile is defined as long as we didn't reach the end of electricalProfiles array
    if (currentProfile) {
      // If start and stop are identical, we can merge the two items
      if (
        currentElectrification.start === currentProfile.start &&
        currentElectrification.stop === currentProfile.stop
      ) {
        return {
          electrificationUsage: {
            ...currentElectrification.values,
            ...currentProfile.values,
          },
          start: currentElectrification.start,
          stop: currentElectrification.stop,
        };
      }

      // Find the profile matching the current electrification range
      // We know we will find one because currentProfile is still defined
      const associatedProfile = electricalProfiles.find(
        (profile) => profile.stop >= currentElectrification.stop
      )!;

      return {
        electrificationUsage: {
          ...currentElectrification.values,
          ...associatedProfile.values,
        },
        start: currentElectrification.start,
        stop: currentElectrification.stop,
      };
    }

    // If we reached the end of the electricalProfiles array, we use its last value for the profile
    // Find the profile matching the current electrification range
    // We know we will find one because theirs last stops are the same
    const associatedProfile = electricalProfiles.find(
      (profile) => profile.stop >= currentElectrification.stop
    )!;

    return {
      electrificationUsage: {
        ...currentElectrification.values,
        ...associatedProfile.values,
      },
      start: currentElectrification.start,
      stop: currentElectrification.stop,
    };
  });

/**
 * Format path properties data to be used in simulation results charts
 */
export const preparePathPropertiesData = (
  electricalProfiles: SimulationResponseSuccess['electrical_profiles'],
  { slopes, curves, electrifications, operational_points, geometry }: PathProperties,
  { path_item_positions, length }: PathfindingResultSuccess,
  trainSchedulePath: TrainScheduleResult['path'],
  t: TFunction
): PathPropertiesFormatted => {
  const formattedSlopes = transformBoundariesDataToPositionDataArray(slopes!, length, 'gradient');
  const formattedCurves = transformBoundariesDataToPositionDataArray(curves!, length, 'radius');
  const electrificationsRanges = transformBoundariesDataToRangesData(electrifications!, length);
  const electricalProfilesRanges = transformBoundariesDataToRangesData(electricalProfiles, length);

  const electrificationRanges = formatElectrificationRanges(
    electrificationsRanges,
    electricalProfilesRanges
  );

  const voltageRanges = getPathVoltages(electrifications!, length);

  const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
    trainSchedulePath,
    path_item_positions,
    operational_points!,
    t
  );

  return {
    electrifications: electrificationRanges,
    curves: formattedCurves,
    slopes: formattedSlopes,
    operationalPoints: operationalPointsWithAllWaypoints,
    geometry: geometry!,
    voltages: voltageRanges,
  };
};

/**
 * Convert an UTC departure time in ISO8601 to seconds and
 * convert it to local time
 */
export const convertDepartureTimeIntoSec = (departureTime: string) => {
  const isoDateInSec = ms2sec(isoDateToMs(departureTime));
  return convertUTCDateToLocalDate(isoDateInSec);
};

export const isInvalidName = (name?: string | null) =>
  !name || name.length > SMALL_INPUT_MAX_LENGTH;

/**
 * Check if the scheduled points are honored with a trainSchedule and a trainSummary
 * @param trainResult
 * @param trainSummary
 * @returns true if the scheduled points are not honored
 */
export const isScheduledPointsNotHonored = (
  trainSchedule: TrainScheduleResult,
  trainSummary: Extract<SimulationSummaryResult, { status: 'success' }>
): boolean => {
  if (trainSummary.path_item_times_final.length !== trainSchedule.path.length) {
    console.error(
      'The number of path_item_times_final does not match the number of paths in the schedule'
    );
    throw new Error('Assertion failed');
  }

  if (!trainSchedule.schedule) return false;

  const pathItemIndexById = new Map<string, number>();
  trainSchedule.path.forEach((pathItem, index) => {
    pathItemIndexById.set(pathItem.id, index);
  });
  return trainSchedule.schedule.some((schedule) => {
    if (!schedule.arrival) return false;
    const matchindIndex = pathItemIndexById.get(schedule.at);
    if (!matchindIndex) {
      throw new Error(
        `No matching index found for schedule ${schedule} on trainSchedule ${trainSchedule}`
      );
    }
    const arrival = Duration.parse(schedule.arrival);
    return (
      Math.abs(arrival.ms - trainSummary.path_item_times_final[matchindIndex]) >=
      ARRIVAL_TIME_ACCEPTABLE_ERROR_MS
    );
  });
};

export const getPathItemByIndexDict = (trainResult: TrainScheduleResult) =>
  trainResult.path.reduce((acc, pathItem, index) => {
    acc[pathItem.id] = index;
    return acc;
  }, {} as Dictionary<number>);

/**
 * Check if the train is too fast with a trainSchedule and a trainSummary
 * @param trainResult
 * @param trainSummary
 * @returns true if the train is too fast
 */
export const isTooFast = (
  trainSchedule: TrainScheduleResult,
  trainSummary: Extract<SimulationSummaryResult, { status: 'success' }>
): boolean => {
  if (
    trainSummary.path_item_times_final.length !== trainSummary.path_item_times_provisional.length
  ) {
    throw new Error('Assertion failed');
  }

  const toCheckPathItemIds = new Set(trainSchedule.margins?.boundaries);
  trainSchedule.schedule?.forEach((schedule) => {
    if (schedule.arrival || schedule.stop_for) {
      toCheckPathItemIds.add(schedule.at);
    }
  });
  toCheckPathItemIds.add(trainSchedule.path[trainSchedule.path.length - 1].id);

  if (toCheckPathItemIds.size === 0) return false;

  const pathItemMap = getPathItemByIndexDict(trainSchedule);

  for (const pathItemId of toCheckPathItemIds) {
    const pathItemIndex = pathItemMap[pathItemId];
    const pathItemTimeFinal = trainSummary.path_item_times_final[pathItemIndex];
    const pathItemTimeProvisional = trainSummary.path_item_times_provisional[pathItemIndex];

    if (pathItemTimeProvisional > pathItemTimeFinal + ARRIVAL_TIME_ACCEPTABLE_ERROR_MS) return true;
  }
  return false;
};
