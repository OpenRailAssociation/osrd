import type { ReportTrain, SimulationResponse } from 'common/api/osrdEditoastApi';
import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import { interpolateValue } from 'modules/simulationResult/SimulationResultExport/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import { type StdcmResultsOperationalPoint, StdcmStopTypes } from '../types';

function generateRandomString(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

/** TODO The number must be calculated from a hash of stdcm inputs (to have a stable number).
 * It is currently generated randomly, so there could be duplicates. Once done, don't forget to update the tests.
 */
export function generateCodeNumber(): string {
  const currentDate = new Date();
  const year = currentDate.getFullYear().toString().substr(-2);
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const randomPart1 = generateRandomString(3);
  const randomPart2 = generateRandomString(3);
  return `${month}${year}-${randomPart1}-${randomPart2}`;
}

export function getStopDurationTime(duration: Duration) {
  return `${Math.round(duration.total('minute'))} min`;
}

function durationToHHMM(duration: Duration): string {
  const totalMinutes = Math.round(duration.total('minute'));
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getTimeAtPosition(
  trainPosition: number,
  trainPositions: number[],
  trainTimes: number[],
  trainDepartureHour: number,
  trainDepartureMinute: number
): Duration {
  const milliseconds = interpolateValue(
    {
      positions: trainPositions,
      speeds: [],
      times: trainTimes,
    },
    trainPosition,
    'times'
  );
  const duration = new Duration({ milliseconds });
  const trainDeparture = new Duration({ hours: trainDepartureHour, minutes: trainDepartureMinute });
  return trainDeparture.add(duration);
}

/**
 * @param position format: Distance from the beginning of the path in mm
 * @param positionsList format: List of positions of a train in mm.
 * @param timesList format: List of times in milliseconds corresponding to the positions in trainPositions.
 * @returns The duration in milliseconds between the first and last occurrence of the position in the trainPositions array
 */
export function getStopDurationAtPosition(
  position: number,
  positionsList: number[],
  timesList: number[]
): Duration | null {
  const firstIndex = positionsList.indexOf(position);
  const lastIndex = positionsList.lastIndexOf(position);
  if (firstIndex !== -1 && lastIndex !== -1 && firstIndex !== lastIndex) {
    return new Duration({ milliseconds: timesList[lastIndex] - timesList[firstIndex] });
  }
  return null;
}

function formatOperationalPointWithTimes(
  op: SuggestedOP,
  trainPositions: number[],
  trainTimes: number[],
  trainDepartureHour: number,
  trainDepartureMinute: number,
  simulationPathSteps: StdcmPathStep[]
): StdcmResultsOperationalPoint {
  const stopBegin = getTimeAtPosition(
    op.positionOnPath,
    trainPositions,
    trainTimes,
    trainDepartureHour,
    trainDepartureMinute
  );

  const duration = getStopDurationAtPosition(op.positionOnPath, trainPositions, trainTimes);
  const durationInSeconds = duration !== null ? duration.total('second') : 0;
  const stopEnd = stopBegin.add(duration || Duration.zero);
  // Find the corresponding stopType from pathSteps
  const correspondingStep = simulationPathSteps.find(
    (step) => step.location && matchPathStepAndOp(step.location, op)
  );
  let stopType;
  if (correspondingStep) {
    stopType = correspondingStep.isVia ? correspondingStep.stopType : StdcmStopTypes.SERVICE_STOP;
  }
  const stopFor = correspondingStep?.isVia ? correspondingStep.stopFor : undefined;

  return {
    opId: op.opId!,
    positionOnPath: op.positionOnPath,
    time: durationToHHMM(stopBegin),
    name: op.name,
    ch: op.ch,
    duration: durationInSeconds,
    stopEndTime: durationToHHMM(stopEnd),
    trackName: op.metadata?.trackName,
    stopType,
    stopFor,
  };
}

/**
 * @param finalOutput Final simulation report containing lists of positions and times of all simulated points
 * @returns A list of all positions at which the trains stops
 */
function findAllStops(positions: number[]): number[] {
  return positions.filter(
    (position, index) =>
      index !== positions.length - 1 &&
      position === positions[index + 1] &&
      (!index || position !== positions[index - 1])
  );
}

/**
 * @param formatedOps List of operational points with times
 * @param stopPositions List of all detected stop positions
 * @param train Object containing simulated train positions, times, and departure time
 * @param simulationPathSteps List of simulation path steps
 * @returns A list of operational points including detected missing stops
 */
export function insertMissingStopsInOperationalPointsWithTimes(
  formatedOps: StdcmResultsOperationalPoint[],
  stopPositions: number[],
  trainPositions: number[],
  trainTimes: number[],
  trainDepartureHour: number,
  trainDepartureMinute: number,
  simulationPathSteps: StdcmPathStep[]
): StdcmResultsOperationalPoint[] {
  const formatedOpsWithAllStops: StdcmResultsOperationalPoint[] = [];
  let opIndex = 0;

  stopPositions.forEach((stopPosition) => {
    // Add operational points until we reach the stop position
    while (opIndex < formatedOps.length && formatedOps[opIndex].positionOnPath < stopPosition) {
      formatedOpsWithAllStops.push({ ...formatedOps[opIndex] });
      opIndex += 1;
    }

    // If there is already an operational point at the stop position, skip
    if (opIndex < formatedOps.length && formatedOps[opIndex].positionOnPath === stopPosition)
      return;

    // At least the departure with pos 0 should have been added, so updatedOperationalPointsWT.length > 1
    const lastAddedOp = formatedOpsWithAllStops.at(-1)!;
    const formattedStop = formatOperationalPointWithTimes(
      {
        positionOnPath: stopPosition,
        offsetOnTrack: NaN,
        track: '',
      },
      trainPositions,
      trainTimes,
      trainDepartureHour,
      trainDepartureMinute,
      simulationPathSteps
    );
    if (lastAddedOp.stopFor && !lastAddedOp.duration) {
      // If a stop was requested at the last op and no stop was performed,
      // we assume the current stop actually corresponds to the last op
      lastAddedOp.duration = formattedStop.duration;
      lastAddedOp.stopEndTime = formattedStop.stopEndTime;
    } else {
      // Otherwise we create a new op at the current stop, with unknown name and minimal informations
      formatedOpsWithAllStops.push(formattedStop);
    }
  });

  // Add all remaining operational points
  formatedOpsWithAllStops.push(...formatedOps.slice(opIndex));

  return formatedOpsWithAllStops;
}

// TODO : Remove this function as soon as fake takeover tracks cease to be used
// It serves to consolidate steps of the form OVERTAKE_n_A;X, OVERTAKE_n_B;X in a single step X
export function consolidateOvertakesToSingleSteps(
  steps: StdcmResultsOperationalPoint[]
): StdcmResultsOperationalPoint[] {
  function convertHHMMTimeToSeconds(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 3600 + minutes * 60;
  }
  const consolidatedSteps: StdcmResultsOperationalPoint[] = [];
  for (let i = 0; i < steps.length - 1; i += 1) {
    const [step, nextStep] = [steps[i], steps[i + 1]];
    const overtakenStepMatch = step.name?.match(/^OVERTAKE.*;(.*)$/);
    if (overtakenStepMatch) {
      const stopDuration =
        convertHHMMTimeToSeconds(nextStep.time!) - convertHHMMTimeToSeconds(step.time!);
      const consolidatedStep = {
        ...step,
        name: overtakenStepMatch[1],
        duration: stopDuration,
        stopEndTime: nextStep.time!,
        stopType: StdcmStopTypes.OVERTAKE,
        stopFor: stopDuration / 60,
      };
      consolidatedSteps.push(consolidatedStep);
      i += 1; // to skip the next step, as we consolidated two overtake steps in one
    } else {
      consolidatedSteps.push(step);
    }
  }
  consolidatedSteps.push(steps[steps.length - 1]);
  return consolidatedSteps;
}

export function getOperationalPointsWithTimes(
  operationalPoints: SuggestedOP[],
  simulation: Extract<SimulationResponse, { status: 'success' }>,
  simulationPathSteps: StdcmPathStep[],
  departureTime: Date
): StdcmResultsOperationalPoint[] {
  const { positions, times } = simulation.final_output;

  const departureHour = departureTime.getHours();
  const departureMinute = departureTime.getMinutes();

  // Map operational points with their positions, times, and stop durations
  const formattedOps = operationalPoints.map((op) =>
    formatOperationalPointWithTimes(
      op,
      positions,
      times,
      departureHour,
      departureMinute,
      simulationPathSteps
    )
  );

  const stopPositions = findAllStops(simulation.final_output.positions);
  const formattedOpsWithAllStops = insertMissingStopsInOperationalPointsWithTimes(
    formattedOps,
    stopPositions,
    positions,
    times,
    departureHour,
    departureMinute,
    simulationPathSteps
  );
  return consolidateOvertakesToSingleSteps(formattedOpsWithAllStops);
}
