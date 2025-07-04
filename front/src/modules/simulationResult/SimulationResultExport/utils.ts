import type {
  OperationalPointWithTimeAndSpeed,
  PathPropertiesFormatted,
} from 'applications/operationalStudies/types';
import {
  type ReportTrain,
  type TrackSection,
  type SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import type { Train } from 'reducers/osrdconf/types';
import type { SpeedRanges } from 'reducers/simulationResults/types';
import { Duration, addDurationToDate } from 'utils/duration';
import { mmToM, msToKmhRounded } from 'utils/physics';

export function massWithOneDecimal(number: number) {
  return Math.round(number / 100) / 10;
}

/**
 * Find the index of the first element of a sorted list greater than a threshold using binary search.
 * It optionally returns undefined if the threshold is smaller than the first element or greater than the last element of the list.
 */
export function fastFindFirstGreater(
  list: number[],
  threshold: number,
  enforceBounding: true
): number | undefined;
export function fastFindFirstGreater(
  list: number[],
  threshold: number,
  enforceBounding?: false
): number;
export function fastFindFirstGreater(list: number[], threshold: number, enforceBounding?: boolean) {
  if (!list.length) return undefined;
  let [low, high] = [0, list.length - 1];
  if (enforceBounding && (list[low] > threshold || list[high] < threshold)) return undefined;

  while (list[low] < threshold) {
    const middle = Math.floor((low + high) / 2);
    if (list[middle] >= threshold) high = middle;
    else low = middle + 1;
  }
  return low;
}

// On the next function, we need to check if the found index is included in the array
// to prevent a white screen when datas are computing and synchronizing when switching the selected timetable item

/**
 * Get the Vmax values at a givenPosition (in meters), using vmax (MRSP in m/s)
 * Returns a list containing only the current Vmax if in the middle of an interval,
 * or the Vmax values before and after if exactly at a bound.
 */
export function findActualVmaxs(givenPosition: number, vmax: SpeedRanges): number[] {
  // givenPosition is in meters
  const vmaxUpperBoundIndex = fastFindFirstGreater(vmax.internalBoundaries, givenPosition);
  // Error case: vmax doesn't respect the SpeedRanges specifications on the lists' lengths
  if (
    vmaxUpperBoundIndex > vmax.speeds.length - 1 ||
    (vmaxUpperBoundIndex === vmax.speeds.length - 1 &&
      vmax.internalBoundaries[vmaxUpperBoundIndex] === givenPosition)
  )
    return [0];
  if (vmax.internalBoundaries[vmaxUpperBoundIndex] === givenPosition)
    return [vmax.speeds[vmaxUpperBoundIndex], vmax.speeds[vmaxUpperBoundIndex + 1]];
  return [vmax.speeds[vmaxUpperBoundIndex]];
}

/**
 * Given the position in m and the Vmax in m/s (boundaries in m too),
 * return the actual Vmax at the givenPosition in km/h (or the Vmaxs before and after if exactly at a bound).
 */
export function getActualVmaxs(givenPosition: number, vmax: SpeedRanges) {
  const actualVMaxs = findActualVmaxs(givenPosition, vmax);
  return actualVMaxs.map((actualVMax) => msToKmhRounded(actualVMax));
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
  const indexGreater = fastFindFirstGreater(reportTrain.positions, opPosition, true);
  if (indexGreater === 0) return reportTrain[value][indexGreater];
  if (indexGreater === undefined)
    throw new Error(
      `Can not interpolate ${value} value with position ${opPosition} out of range for ${reportTrain.positions}`
    );

  const leftPosition = reportTrain.positions[indexGreater - 1];
  const rightPosition = reportTrain.positions[indexGreater];
  const leftValue = reportTrain[value][indexGreater - 1];
  const rightValue = reportTrain[value][indexGreater];
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
  simulatedTimetableItem: SimulationResponseSuccess,
  timetableItem: Train,
  trackSections: Record<string, TrackSection>
): OperationalPointWithTimeAndSpeed[] => {
  // Format operational points
  const formattedStops: OperationalPointWithTimeAndSpeed[] = [];

  const { final_output } = simulatedTimetableItem;

  operationalPoints.forEach((op) => {
    const { time: finalOutputTime, speed: finalOutputSpeed } = getTimeAndSpeed(final_output, op);

    // Get duration
    let stepDuration = Duration.zero;
    const correspondingStep = timetableItem.path.find((step) =>
      matchPathStepAndOp(step, {
        opId: op.id,
        uic: op.extensions?.identifier?.uic,
        ch: op.extensions?.sncf?.ch,
        trigram: op.extensions?.sncf?.trigram,
        track: op.part.track,
        offsetOnTrack: op.part.position,
      })
    );
    if (correspondingStep) {
      const correspondingSchedule = timetableItem.schedule?.find(
        (step) => step.at === correspondingStep.id
      );
      if (correspondingSchedule && correspondingSchedule.stop_for) {
        stepDuration = Duration.parse(correspondingSchedule.stop_for);
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
      time: addDurationToDate(
        new Date(timetableItem.start_time),
        new Duration({ milliseconds: finalOutputTime })
      ),
      speed: finalOutputSpeed,
      ...opCommonProp,
    });
  });
  return formattedStops;
};
