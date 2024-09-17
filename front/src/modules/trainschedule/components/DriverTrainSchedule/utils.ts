import * as d3 from 'd3';
import { uniq } from 'lodash';

import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import { convertDepartureTimeIntoSec } from 'applications/operationalStudies/utils';
import {
  osrdEditoastApi,
  type ReportTrain,
  type TrackSection,
  type TrainScheduleBase,
} from 'common/api/osrdEditoastApi';
import type { PositionSpeedTime, SpeedRanges } from 'reducers/simulationResults/types';
import { store } from 'store';
import { mmToM, msToKmhRounded } from 'utils/physics';
import { ISO8601Duration2sec, ms2sec } from 'utils/timeManipulation';

import type { OperationalPointWithTimeAndSpeed } from './types';

export function massWithOneDecimal(number: number) {
  return Math.round(number / 100) / 10;
}

export function getTime(sec: number) {
  const timeplus = new Date(sec * 1000);
  const time = timeplus.toISOString().substr(11, 8);
  const sixthDigit = parseInt(time[6], 10);
  const seventhDigit = parseInt(time[7], 10);
  if (sixthDigit >= 0 && sixthDigit < 2) {
    if (sixthDigit === 1) {
      if (seventhDigit <= 4) {
        return time.slice(0, 5);
      }
      return `${time.slice(0, 5)}+`;
    }
    return time.slice(0, 5);
  }
  if (sixthDigit >= 1 && sixthDigit < 5) {
    if (sixthDigit === 4) {
      if (seventhDigit <= 4) {
        return `${time.slice(0, 5)}+`;
      }
      if (seventhDigit > 4) {
        timeplus.setMinutes(timeplus.getMinutes() + 1);
        timeplus.setSeconds(0);
        return timeplus.toISOString().substr(11, 8).slice(0, 5);
      }
    }
    return `${time.slice(0, 5)}+`;
  }
  timeplus.setMinutes(timeplus.getMinutes() + 1);
  timeplus.setSeconds(0);
  return timeplus.toISOString().substr(11, 8).slice(0, 5);
}

// On the next 3 functions, we need to check if the found index is included in the array
// to prevent a white screen when datas are computing and synchronizing when switching the selected train
export function getActualSpeedLeft(givenPosition: number, speed: PositionSpeedTime[]) {
  const speedPosition = d3.bisectLeft(
    speed.map((d) => d.position),
    givenPosition
  );
  if (speedPosition >= speed.length - 1) {
    return speed[speed.length - 1].speed * 3.6;
  }
  return speed[speedPosition].speed * 3.6;
}

export function getActualPositionLeft(givenPosition: number, speed: PositionSpeedTime[]) {
  const speedPosition = d3.bisectLeft(
    speed.map((d) => d.position),
    givenPosition
  );
  if (speedPosition >= speed.length - 1) return speed[speed.length - 1].position / 1000;
  return speed[speedPosition].position / 1000;
}

/**
 * Get the Vmax at a givenPosition (in meters), using vmax (MRSP in m/s)
 * Returns the current Vmax if in the middle of an interval, or
 * the min of the Vmax before and after if exactly at a bound.
 */
export function findActualVmax(givenPosition: number, vmax: SpeedRanges): number {
  // givenPosition is in meters
  const vmaxUpperBoundIndex = d3.bisectRight(vmax.internalBoundaries, givenPosition);
  // Error case: vmax doesn't respect the SpeedRanges specifications on the lists' lengths
  if (vmaxUpperBoundIndex > vmax.speeds.length - 1) return 0;
  // If exactly on a speed-limit change, use the minimal value of both side
  const actualVmaxMetersPerSecond =
    vmaxUpperBoundIndex > 0 && vmax.internalBoundaries[vmaxUpperBoundIndex - 1] === givenPosition
      ? Math.min(vmax.speeds[vmaxUpperBoundIndex], vmax.speeds[vmaxUpperBoundIndex - 1])
      : vmax.speeds[vmaxUpperBoundIndex];

  return actualVmaxMetersPerSecond;
}

/**
 * Given the position in m and the vmax in m/s (boundaries in m too),
 * return the actual vmax at the givenPosition in km/h
 */
export function getActualVmax(givenPosition: number, vmax: SpeedRanges) {
  const actualVMax = findActualVmax(givenPosition, vmax);
  return msToKmhRounded(actualVMax);
}

export function getActualSpeedRight(givenPosition: number, speed: PositionSpeedTime[]) {
  const speedPosition =
    d3.bisectLeft(
      speed.map((d) => d.position),
      givenPosition
    ) - 1;
  return speedPosition <= 0 ? speed[0].speed * 3.6 : speed[speedPosition].speed * 3.6;
}

export function getActualPositionRight(givenPosition: number, speed: PositionSpeedTime[]) {
  const speedPosition =
    d3.bisectLeft(
      speed.map((d) => d.position),
      givenPosition
    ) - 1;
  return speedPosition <= 0 ? speed[0].position / 1000 : speed[speedPosition].position / 1000;
}

export function getActualSpeed(givenPosition: number, speed: PositionSpeedTime[]) {
  const speedA = getActualSpeedRight(givenPosition, speed);
  const speedB = getActualSpeedLeft(givenPosition, speed);
  const posA = getActualPositionRight(givenPosition, speed);
  const posB = getActualPositionLeft(givenPosition, speed);
  if (speedA === 0 || speedB === 0) return 0;
  const a = (speedB - speedA) / (posB - posA);
  const b = speedA - a * posA;
  return Math.round(a * (givenPosition / 1000) + b);
}

interface SpeedDistance {
  distance: number;
  speed: number;
}

export function getAverageSpeed(posA: number, posB: number, speedList: PositionSpeedTime[]) {
  let totalDistance = 0;
  const speedsAndDistances: SpeedDistance[] = [];
  let averageSpeed = 0;

  // Filter concerned speed by posA & posB (all speed sections between the two positions)
  const concernedSpeeds = speedList.filter((item) => item.position >= posA && item.position < posB);

  // When concernedSpeeds is empty or < 2, take nearest plateau speed
  if (concernedSpeeds.length === 1) return Math.round(concernedSpeeds[0].speed * 3.6 * 10) / 10;
  if (concernedSpeeds.length === 0) {
    let lastKnownSpeedPosition = d3.bisectLeft(
      speedList.map((step) => step.position),
      posB
    );
    if (lastKnownSpeedPosition >= speedList.length) {
      lastKnownSpeedPosition = speedList.length - 1;
    }
    return Math.round(speedList[lastKnownSpeedPosition].speed * 3.6 * 10) / 10;
  }

  // Get an array with speed along distance and set a sum of distance
  concernedSpeeds.forEach((actualPosition, idx) => {
    if (idx !== 0) {
      const actualDistance = actualPosition.position - speedList[idx - 1].position;
      speedsAndDistances.push({
        speed: actualPosition.speed,
        distance: actualDistance,
      } as SpeedDistance);
      totalDistance += actualDistance;
    }
  });

  // Weight speed with distance ratio and sum it for average speed
  speedsAndDistances.forEach((step) => {
    averageSpeed += step.speed * (step.distance / totalDistance);
  });

  // Get average speed with decimal in km/h
  return Math.round(averageSpeed * 3.6 * 10) / 10;
}

export const isEco = (train: TrainScheduleBase) => {
  const { schedule, margins } = train;
  return (
    (schedule && schedule.some((item) => item.arrival !== null)) ||
    (margins && margins.values.some((value) => value !== '0%' && value !== '0min/100km'))
  );
};

/**
 * Interpolate a speed or time value at a given position when the operational point's position
 * doesn't match any report train position
 */
export const interpolateValue = (
  reportTrain: { positions: number[]; speeds: number[]; times: number[] },
  opPosition: number,
  value: 'speeds' | 'times'
) => {
  // Get the index of the first report train position greater than the operational point position
  const bisector = d3.bisectLeft(reportTrain.positions, opPosition);
  if (bisector === 0) return reportTrain[value][bisector];

  const leftPosition = reportTrain.positions[bisector - 1];
  const rightPosition = reportTrain.positions[bisector];
  const leftValue = reportTrain[value][bisector - 1];
  const rightValue = reportTrain[value][bisector];
  const totalDistance = rightPosition - leftPosition;
  const distance = opPosition - leftPosition;
  const totalDifference = rightValue - leftValue;
  return leftValue + (totalDifference * distance) / totalDistance;
};

const getTimeAndSpeed = (
  simulationReport: ReportTrain,
  op: PathPropertiesFormatted['operationalPoints'][number]
) => {
  const matchingReportTrainIndex = simulationReport.positions.findIndex(
    (position) => position === op.position
  );

  let time = 0;
  let speed = 0;

  if (matchingReportTrainIndex === -1) {
    time = interpolateValue(simulationReport, op.position, 'times');
    speed = interpolateValue(simulationReport, op.position, 'speeds');
  } else {
    time = simulationReport.times[matchingReportTrainIndex];
    speed = simulationReport.speeds[matchingReportTrainIndex];
  }

  return { time, speed };
};

/**
 * Associate each operational point with a time by comparing it to a report train based
 * on their positions if they match or interpolate its time if they don't
 * @returns the computed operational points for each simulation (base and finalOutput)
 */
export const formatOperationalPoints = async (
  operationalPoints: PathPropertiesFormatted['operationalPoints'],
  simulatedTrain: SimulationResponseSuccess,
  train: TrainScheduleBase,
  infraId: number
): Promise<{
  base: OperationalPointWithTimeAndSpeed[];
  finalOutput: OperationalPointWithTimeAndSpeed[];
}> => {
  // Get operational points metadata
  const trackIds = uniq(operationalPoints.map((op) => op.part.track));
  const trackSections = await store
    .dispatch(
      osrdEditoastApi.endpoints.postInfraByInfraIdObjectsAndObjectType.initiate({
        infraId,
        objectType: 'TrackSection',
        body: trackIds,
      })
    )
    .unwrap();

  // Format operational points
  const formattedStops: {
    base: OperationalPointWithTimeAndSpeed[];
    finalOutput: OperationalPointWithTimeAndSpeed[];
  } = { base: [], finalOutput: [] };

  const { base, final_output } = simulatedTrain;

  operationalPoints.forEach((op) => {
    const { time: baseTime, speed: baseSpeed } = getTimeAndSpeed(base, op);

    const { time: finalOutputTime, speed: finalOutputSpeed } = getTimeAndSpeed(final_output, op);

    // Get duration
    let stepDuration = 0;
    const correspondingStep = train.path.find(
      (step) =>
        'uic' in step &&
        step.uic === op.extensions?.identifier?.uic &&
        step.secondary_code === op.extensions.sncf?.ch
    );
    if (correspondingStep) {
      const correspondingSchedule = train.schedule?.find(
        (step) => step.at === correspondingStep.id
      );
      if (correspondingSchedule && correspondingSchedule.stop_for) {
        stepDuration = ISO8601Duration2sec(correspondingSchedule.stop_for);
      }
    }

    const associatedTrackSection = trackSections.find(
      (trackSection) => (trackSection.railjson as TrackSection).id === op.part.track
    );

    let metadata;
    if (associatedTrackSection) {
      metadata = (associatedTrackSection.railjson as TrackSectionEntity['properties']).extensions
        ?.sncf;
    }

    const opCommonProp = {
      id: op.id,
      name: op.extensions?.identifier?.name || null,
      duration: stepDuration,
      position: mmToM(op.position),
      line_code: metadata?.line_code || null,
      track_number: metadata?.track_number || null,
      line_name: metadata?.line_name || null,
      track_name: metadata?.track_name || null,
      ch: op.extensions?.sncf?.ch || null,
    };

    formattedStops.base.push({
      // time refers to the time elapsed since departure so we need to add it to the start time
      time: convertDepartureTimeIntoSec(train.start_time) + ms2sec(baseTime),
      speed: baseSpeed,
      ...opCommonProp,
    });

    formattedStops.finalOutput.push({
      time: convertDepartureTimeIntoSec(train.start_time) + ms2sec(finalOutputTime),
      speed: finalOutputSpeed,
      ...opCommonProp,
    });
  });
  return formattedStops;
};
