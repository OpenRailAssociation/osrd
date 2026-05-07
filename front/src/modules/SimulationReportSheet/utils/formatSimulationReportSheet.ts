import type { TFunction } from 'i18next';

import type { TimingContext } from 'applications/stdcm/components/StdcmResults/SendToRailwayManagerModal';
import {
  type SimilarTrainWithSecondaryCode,
  type StdcmPathProperties,
  type StdcmResultsOperationalPoint,
  StdcmStopTypes,
} from 'applications/stdcm/types';
import type { SimulationResponseSuccess } from 'common/api/osrdEditoastApi';
import type { ConsistChange, RequestedStep, StepType } from 'common/api/osrdRailwayManagerApi';
import { interpolateValue } from 'modules/simulationResult/helpers/utils';
import type { SuggestedOP } from 'modules/trainSchedule/types';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { tToKg } from 'utils/physics';
import { capitalizeFirstLetter } from 'utils/strings';

export const MAX_TOLERANCE = new Duration({ minutes: 240 });
const STOP_TYPE_MAPPING: Record<StdcmStopTypes, StepType> = {
  [StdcmStopTypes.PASSAGE_TIME]: 'VIA',
  [StdcmStopTypes.DRIVER_SWITCH]: 'DRIVER_SWITCH',
  [StdcmStopTypes.SERVICE_STOP]: 'STOP',
  [StdcmStopTypes.OVERTAKE]: 'VIA',
  [StdcmStopTypes.CONSIST_CHANGE]: 'STOP',
};

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

/**
 * @param duration Duration object representing the total duration
 * @returns The duration formatted as a string in "X min" format
 */
export function getStopDurationTime(duration?: Duration): string {
  if (!duration) return '';
  return `${Math.round(duration.total('minute'))} min`;
}

/**
 * @param duration Duration object
 * @returns The duration formatted as a string in "HH:MM" format
 */
function durationToHHMM(duration: Duration): string {
  const totalMinutes = Math.round(duration.total('minute'));
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * @property positions List of positions of a train in mm
 * @property times List of times in milliseconds corresponding to the train positions
 * @property speeds List of speeds in m/s corresponding to the train positions
 * @property departureHour Hour of the train departure (24h format)
 * @property departureMinute Minute of the train departure
 */
type TrainSimulation = {
  positions: number[];
  times: number[];
  speeds: number[];
  departureHour: number;
  departureMinute: number;
};

/**
 * @param position Distance from the beginning of the path in mm
 * @param train Object containing simulated train positions, times, and departure time
 * @returns The estimated time of passage at the given position in format hh:mm
 */
function getTimeAtPosition(position: number, train: TrainSimulation): Duration {
  const milliseconds = interpolateValue(
    {
      positions: train.positions,
      speeds: [],
      times: train.times,
    },
    position,
    'times'
  );
  const duration = new Duration({ milliseconds });
  const trainDeparture = new Duration({
    hours: train.departureHour,
    minutes: train.departureMinute,
  });
  return trainDeparture.add(duration);
}

/**
 * @param position Distance from the beginning of the path in mm
 * @param train Object containing simulated train positions, times, and departure time
 * @returns The duration in milliseconds between the first and last occurrence of the position in the train simulation, or null if the position is not a stop.
 *
 * Here we do not consider the train departure and arrival as stops unless the stop duration at these points is non zero.
 */
export function getStopDurationAtPosition(
  position: number,
  train: TrainSimulation
): Duration | null {
  const firstIndex = train.positions.indexOf(position);
  const lastIndex = train.positions.lastIndexOf(position);
  if (firstIndex === -1) return null;
  if (firstIndex !== lastIndex) {
    return new Duration({ milliseconds: train.times[lastIndex] - train.times[firstIndex] });
  }
  if (train.speeds[firstIndex] === 0 && firstIndex && lastIndex !== train.positions.length - 1)
    return new Duration({ milliseconds: 0 });
  return null;
}

/**
 * @param op Operational point to format
 * @param train Object containing simulated train positions, times, and departure time
 * @returns A formatted operational point with required fields only, including calculated stop duration and departure time
 */
function formatMinimalOperationalPointWithTimes(
  op: Pick<SuggestedOP, 'positionOnPath' | 'opId'>,
  train: TrainSimulation
): StdcmResultsOperationalPoint {
  const stopBegin = getTimeAtPosition(op.positionOnPath, train);

  const duration = getStopDurationAtPosition(op.positionOnPath, train);
  const stopEnd = stopBegin.add(duration || Duration.zero);

  return {
    opId: op.opId,
    positionOnPath: op.positionOnPath,
    time: durationToHHMM(stopBegin),
    duration,
    stopEndTime: durationToHHMM(stopEnd),
    stopRequested: false,
    weight: null,
  };
}

/**
 * @param suggestedOp Suggested operational point to format
 * @param operationalPoints List of all operational points to retrieve the weight of the formatted OP
 * @param train Object containing simulated train positions, times, and departure time
 * @param simulationPathSteps List of simulation path steps
 * @returns A fully formatted operational point with calculated stop duration and departure time
 */
function formatOperationalPointWithTimesAndWeight(
  suggestedOp: SuggestedOP,
  operationalPoints: StdcmPathProperties['operational_points'],
  train: TrainSimulation,
  simulationPathSteps: StdcmPathStep[]
): StdcmResultsOperationalPoint {
  const partiallyFormattedOp = formatMinimalOperationalPointWithTimes(suggestedOp, train);
  // Find the corresponding stopType from pathSteps
  const correspondingStep = simulationPathSteps.find(
    (step) => step.operationalPoint && step.operationalPoint.id === suggestedOp.opId
  );
  let stopType;
  if (correspondingStep) {
    if (correspondingStep.isVia) {
      stopType = correspondingStep.consistChange
        ? StdcmStopTypes.CONSIST_CHANGE
        : correspondingStep.stopType;
    } else {
      stopType = StdcmStopTypes.SERVICE_STOP;
    }
  }
  const stopRequested =
    correspondingStep !== undefined &&
    correspondingStep.isVia &&
    correspondingStep.stopFor !== undefined;

  return {
    ...partiallyFormattedOp,
    name: suggestedOp.name,
    ch: suggestedOp.ch,
    trackName: suggestedOp.metadata?.trackName,
    stopType,
    stopRequested,
    weight: operationalPoints.find((op) => op.id === suggestedOp.opId)?.weight ?? null,
  };
}

/**
 * @param positions Lists of all positions of simulated points of a train simulation report
 * @returns A list of all positions at which the train stops
 */
export function findAllStops(positions: number[], speeds: number[]): number[] {
  return positions.filter(
    (position, index) =>
      (index === positions.length - 1 || // last op is a stop
        speeds[index] === 0 || // any position with 0 speed is a stop
        position === positions[index + 1]) && // any repeated position is a stop
      (!index || position !== positions[index - 1]) // removes duplicates (duplicates are necessarily subsequent)
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
  train: TrainSimulation
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
    const formattedStop = formatMinimalOperationalPointWithTimes(
      {
        positionOnPath: stopPosition,
        opId: `unplanned_stop_at_${stopPosition}`,
      },
      train
    );
    if (lastAddedOp.stopRequested && lastAddedOp.duration === null) {
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
        duration: new Duration({ seconds: stopDuration }),
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

/**
 * @param operationalPoints List of operational points
 * @param suggestedOperationalPoints List of suggested operational points to be formated and enriched
 * @param opIdsToExclude List of operational point IDs to exclude from the simulation sheet (e.g., service track OPs that cannot be modeled). Exception: OPs explicitly requested by the user (origin, destination, via points, or stops) are never excluded.
 * @param simulation Simulation response containing final output positions and times
 * @param simulationPathSteps List of simulation path steps
 * @param departureTime Departure time in hh:mm format
 * @returns A list of formated operational points with weight, times and stop durations
 */
export function getOperationalPointsWithTimes({
  operationalPoints,
  suggestedOperationalPoints,
  opIdsToExclude,
  simulation,
  simulationPathSteps,
  departureTime,
}: {
  operationalPoints: StdcmPathProperties['operational_points'];
  suggestedOperationalPoints: SuggestedOP[];
  opIdsToExclude: string[];
  simulation: SimulationResponseSuccess;
  simulationPathSteps: StdcmPathStep[];
  departureTime: Date;
}): StdcmResultsOperationalPoint[] {
  const { positions, times, speeds } = simulation.final_output;

  const departureHour = departureTime.getHours();
  const departureMinute = departureTime.getMinutes();

  const formattedOps = suggestedOperationalPoints
    .filter((suggestedOp) => {
      // Keep if the OP is not in the exclusion list
      if (!suggestedOp.opId || !opIdsToExclude.includes(suggestedOp.opId)) return true;
      // Keep if explicitly requested by the user (origin, destination, via point or stop)

      const isRequestedPoint = simulationPathSteps.some(
        (step) => step.operationalPoint && step.operationalPoint.id === suggestedOp.opId
      );

      return isRequestedPoint;
    })
    // Map operational points with their positions, times, and stop durations
    .map((suggestedOp) =>
      formatOperationalPointWithTimesAndWeight(
        suggestedOp,
        operationalPoints,
        { positions, times, speeds, departureHour, departureMinute },
        simulationPathSteps
      )
    );

  const stopPositions = findAllStops(positions, speeds);
  const formattedOpsWithAllStops = insertMissingStopsInOperationalPointsWithTimes(
    formattedOps,
    stopPositions,
    { positions, times, speeds, departureHour, departureMinute }
  );
  return consolidateOvertakesToSingleSteps(formattedOpsWithAllStops);
}

export const getArrivalTimes = (
  step: StdcmPathStep,
  t: TFunction<'stdcm'>,
  dateTimeLocale: Intl.Locale
) => {
  if (step.isVia) return '';
  return step.arrival && step.arrivalType === 'preciseTime'
    ? step.arrival.toLocaleString(dateTimeLocale, { timeStyle: 'short' })
    : t('reportSheet.asap');
};

export const getSecondaryCode = ({ operationalPoint }: StdcmPathStep) =>
  operationalPoint!.secondaryCode ?? '';

export const getStopType = (stopType: StdcmStopTypes | undefined, t: TFunction<'stdcm'>) =>
  !stopType
    ? t('reportSheet.serviceStop')
    : capitalizeFirstLetter(t(`trainPath.stopType.${stopType}`));

// Maps Stdcm path steps to the Step payload expected by the Railway Manager API.
export const transformStepsToApiFormat = (
  steps: StdcmPathStep[],
  { originArrivalTime, destinationArrivalTime, beforeTolerance, afterTolerance }: TimingContext
): RequestedStep[] =>
  steps.map((step, index) => {
    const baseStep: RequestedStep = {
      duration: 0,
      location: {
        uic: step.operationalPoint!.uic,
        secondary_code: step.operationalPoint!.secondaryCode!,
      },
    };

    if (step.isVia) {
      const formatedConsistChange: ConsistChange | undefined = step.consistChange
        ? {
            rolling_stock: step.consistChange.rollingStockName!,
            towed_rolling_stock: step.consistChange.towedRollingStockName,
            total_mass: tToKg(step.consistChange.totalMass!),
            total_length: step.consistChange.totalLength!,
          }
        : undefined;
      return {
        ...baseStep,
        duration: step.stopFor?.ms || 0,
        type: STOP_TYPE_MAPPING[step.stopType],
        consist_change: formatedConsistChange,
      };
    }

    if (step.arrivalType !== 'preciseTime') {
      return {
        ...baseStep,
      };
    }

    let arrival_time = originArrivalTime.toISOString();

    if (index === steps.length - 1 && destinationArrivalTime) {
      arrival_time = destinationArrivalTime.toISOString();
    }

    return {
      ...baseStep,
      timing_data: {
        arrival_time,
        arrival_time_tolerance_before: beforeTolerance.ms,
        arrival_time_tolerance_after: afterTolerance.ms,
      },
    };
  });

export const createSimilarTrainPayload = (similarTrains: SimilarTrainWithSecondaryCode[]) => {
  if (!similarTrains?.[0]?.train_name) return null;

  return {
    path_date: similarTrains[0].start_time
      ? new Date(similarTrains[0].start_time).toISOString()
      : new Date().toISOString(),
    name: similarTrains[0].train_name,
  };
};

export const validateTolerance = (num: Duration): boolean =>
  !isNaN(num.ms) && num >= Duration.zero && num <= MAX_TOLERANCE;
