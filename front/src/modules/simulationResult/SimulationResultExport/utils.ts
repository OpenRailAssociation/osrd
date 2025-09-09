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
import { fastFindFirstGreater, interpolateValue } from 'modules/simulationResult/helpers/utils';
import type { Train } from 'reducers/osrdconf/types';
import type { SpeedRanges } from 'reducers/simulationResults/types';
import { Duration, addDurationToDate } from 'utils/duration';
import { mmToM, msToKmhRounded } from 'utils/physics';

export function massWithOneDecimal(number: number) {
  return Math.round(number / 100) / 10;
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
    let stepDuration: Duration | undefined;
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
