import { omit } from 'lodash';

import type { PathProperties, ProjectPathTrainResult } from 'common/api/osrdEditoastApi';
import { convertUTCDateToLocalDate, isoDateToMs } from 'utils/date';
import { mmToM } from 'utils/physics';
import { ms2sec } from 'utils/timeManipulation';

import type {
  BoundariesData,
  ElectricalBoundariesData,
  ElectricalProfileValue,
  ElectricalRangesData,
  ElectrificationRangeV2,
  ElectrificationValue,
  PathPropertiesFormatted,
  PositionData,
  SimulationResponseSuccess,
  TrainSpaceTimeData,
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
  const formatedData = boundariesData.boundaries.map((boundary, index) => ({
    start: index === 0 ? 0 : mmToM(boundariesData.boundaries[index - 1]),
    stop: mmToM(boundary),
    values: boundariesData.values[index],
  }));

  formatedData.push({
    start: mmToM(boundariesData.boundaries[boundariesData.boundaries.length - 1]),
    stop: mmToM(pathLength),
    values: boundariesData.values[boundariesData.values.length - 1],
  });

  return formatedData;
};

export const formatElectrificationRanges = (
  electrifications: ElectricalRangesData<ElectrificationValue>[],
  electricalProfiles: ElectricalRangesData<ElectricalProfileValue>[]
): ElectrificationRangeV2[] =>
  // Electrifications can be of three types, electricalProfiles only two, so we know electrifications
  // will always be at least as long as electricalProfiles so we can use it as the main array
  electrifications.reduce((acc: ElectrificationRangeV2[], curr, index) => {
    const currentElectrification = curr;
    const currentProfile = electricalProfiles[index];

    // currentProfile is defined as long as we didn't reach the end of electricalProfiles array
    if (currentProfile) {
      // If start and stop are identical, we can merge the two items
      if (
        currentElectrification.start === currentProfile.start &&
        currentElectrification.stop === currentProfile.stop
      ) {
        acc.push({
          electrificationUsage: {
            ...currentElectrification.values,
            ...currentProfile.values,
          },
          start: currentElectrification.start,
          stop: currentElectrification.stop,
        });
      } else {
        // Find the profile matching the current electrification range
        // We know we will find one because currentProfile is still defined
        const associatedProfile = electricalProfiles.find(
          (profile) => profile.stop >= currentElectrification.stop
        ) as ElectricalRangesData<ElectricalProfileValue>;

        acc.push({
          electrificationUsage: {
            ...currentElectrification.values,
            ...associatedProfile.values,
          },
          start: currentElectrification.start,
          stop: currentElectrification.stop,
        });
      }
      // If we reached the end of the electricalProfiles array, we use its last value for the profile
    } else {
      // Find the profile matching the current electrification range
      // We know we will find one because theirs last stops are the same
      const associatedProfile = electricalProfiles.find(
        (profile) => profile.stop >= currentElectrification.stop
      ) as ElectricalRangesData<ElectricalProfileValue>;

      acc.push({
        electrificationUsage: {
          ...currentElectrification.values,
          ...associatedProfile.values,
        },
        start: currentElectrification.start,
        stop: currentElectrification.stop,
      });
    }

    return acc;
  }, []);

/**
 * Format path propreties data to be used in simulation results charts
 */
export const preparePathPropertiesData = (
  electricalProfiles: SimulationResponseSuccess['electrical_profiles'],
  { slopes, curves, electrifications, operational_points, geometry }: PathProperties,
  pathLength: number
): PathPropertiesFormatted => {
  const formattedSlopes = transformBoundariesDataToPositionDataArray(
    slopes as NonNullable<PathProperties['slopes']>,
    pathLength,
    'gradient'
  );

  const formattedCurves = transformBoundariesDataToPositionDataArray(
    curves as NonNullable<PathProperties['curves']>,
    pathLength,
    'radius'
  );

  const electrificationsRanges = transformBoundariesDataToRangesData(
    electrifications as NonNullable<PathProperties['electrifications']>,
    pathLength
  ) as ElectricalRangesData<ElectrificationValue>[];

  const electricalProfilesRanges = transformBoundariesDataToRangesData(
    electricalProfiles,
    pathLength
  ) as ElectricalRangesData<ElectricalProfileValue>[];

  const electrificationRanges = formatElectrificationRanges(
    electrificationsRanges,
    electricalProfilesRanges
  );

  return {
    electrifications: electrificationRanges,
    curves: formattedCurves,
    slopes: formattedSlopes,
    operationalPoints: operational_points as NonNullable<PathProperties['operational_points']>,
    geometry: geometry as NonNullable<PathProperties['geometry']>,
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

export const formatSpaceTimeData = (
  trainId: string,
  projectPathTrainResult: ProjectPathTrainResult,
  trainName?: string
): TrainSpaceTimeData => {
  const spaceTimeCurves = projectPathTrainResult.space_time_curves.map((spaceTimeCurve) =>
    spaceTimeCurve.times.map((time, index) => ({
      // time refers to the time elapsed since departure so we need to add it to the start time
      time: convertDepartureTimeIntoSec(projectPathTrainResult.departure_time) + ms2sec(time),
      headPosition: mmToM(spaceTimeCurve.positions[index]),
      tailPosition: mmToM(
        spaceTimeCurve.positions[index] - projectPathTrainResult.rolling_stock_length
      ),
    }))
  );

  // We keep snake case here because we don't want to change everything in the d3 helpers
  // since we will remove them soon
  const signal_updates = projectPathTrainResult.signal_updates.map((signalUpdate) => ({
    ...signalUpdate,
    position_end: mmToM(signalUpdate.position_end),
    position_start: mmToM(signalUpdate.position_start),
    time_end:
      convertDepartureTimeIntoSec(projectPathTrainResult.departure_time) +
      ms2sec(signalUpdate.time_end),
    time_start:
      convertDepartureTimeIntoSec(projectPathTrainResult.departure_time) +
      ms2sec(signalUpdate.time_start),
  }));

  return {
    ...omit(projectPathTrainResult, ['space_time_curves', 'signal_updates']),
    spaceTimeCurves,
    signal_updates,
    id: +trainId,
    trainName: trainName || 'Train name not found',
  };
};
