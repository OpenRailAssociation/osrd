import type { SimulationResponse } from 'common/api/osrdEditoastApi';
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
export function getStopDurationBetweenTwoPositions(
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
  departureTime: string
): StdcmResultsOperationalPoint[] {
  const { positions, times } = simulation.final_output;
  const pathDepartureTime = new Date(departureTime).toLocaleTimeString().substring(0, 5);

  // Parse departure time into hours and minutes
  const [departureHour, departureMinute] = pathDepartureTime.split(':').map(Number);

  // Map operational points with their positions, times, and stop durations
  const opResults = operationalPoints.map((op) => {
    const stopBegin = getTimeAtPosition(
      op.positionOnPath,
      positions,
      times,
      departureHour,
      departureMinute
    );

    const isRequestedOp = simulationPathSteps.some(
      (step) => step.location?.name === op.name && step.location?.secondary_code === op.ch
    );

    const duration = getStopDurationBetweenTwoPositions(op.positionOnPath, positions, times);
    const durationInSeconds = isRequestedOp && duration !== null ? duration.total('second') : 0;
    const stopEnd = stopBegin.add(duration || Duration.zero);

    // Find the corresponding stopType from pathSteps
    const correspondingStep = simulationPathSteps.find(
      (step) => step.location && matchPathStepAndOp(step.location, op)
    );
    let stopType;
    if (correspondingStep) {
      stopType = !correspondingStep.isVia
        ? StdcmStopTypes.SERVICE_STOP
        : correspondingStep.stopType;
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
  });

  return consolidateOvertakesToSingleSteps(opResults);
}
