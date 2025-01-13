import * as d3 from 'd3';

import type {
  OperationalPointWithTimeAndSpeed,
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import { convertDepartureTimeIntoSec } from 'applications/operationalStudies/utils';
import {
  type ReportTrain,
  type TrackSection,
  type TrainScheduleBase,
} from 'common/api/osrdEditoastApi';
import type { SpeedRanges } from 'reducers/simulationResults/types';
import { Duration } from 'utils/duration';
import { mmToM, msToKmhRounded } from 'utils/physics';
import { ms2sec } from 'utils/timeManipulation';

export function massWithOneDecimal(number: number) {
  return Math.round(number / 100) / 10;
}

// On the next function, we need to check if the found index is included in the array
// to prevent a white screen when datas are computing and synchronizing when switching the selected train

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
export const formatOperationalPoints = (
  operationalPoints: PathPropertiesFormatted['operationalPoints'],
  simulatedTrain: SimulationResponseSuccess,
  train: TrainScheduleBase,
  trackSections: Record<string, TrackSection>
): OperationalPointWithTimeAndSpeed[] => {
  // Format operational points
  const formattedStops: OperationalPointWithTimeAndSpeed[] = [];

  const { final_output } = simulatedTrain;

  operationalPoints.forEach((op) => {
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
        stepDuration = ms2sec(Duration.parse(correspondingSchedule.stop_for).ms);
      }
    }

    const associatedTrackSection = trackSections[op.part.track];

    let metadata;
    if (associatedTrackSection) {
      metadata = associatedTrackSection.extensions?.sncf;
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

    formattedStops.push({
      time: convertDepartureTimeIntoSec(train.start_time) + ms2sec(finalOutputTime),
      speed: finalOutputSpeed,
      ...opCommonProp,
    });
  });
  return formattedStops;
};
