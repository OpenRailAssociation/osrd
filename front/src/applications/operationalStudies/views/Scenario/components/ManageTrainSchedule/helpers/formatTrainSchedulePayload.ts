import { compact } from 'lodash';

import type { PacedTrainException, TrainSchedule } from 'common/api/osrdEditoastApi';
import { isPacedTrainBase } from 'modules/trainSchedule/helpers/pacedTrain';
import type { PacedTrainWithDetails, TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { OperationalStudiesConfState, OccurrenceId, PathStep } from 'reducers/osrdconf/types';
import { startTimeToMs } from 'utils/duration';
import { kmhToMs } from 'utils/physics';
import { extractOccurrenceIndexFromOccurrenceId, isIndexedOccurrenceId } from 'utils/trainId';

import { generatePacedTrainException } from './buildPacedTrainException';
import formatMargin from './formatMargin';
import formatSchedule from './formatSchedule';

/** Ensure the first waypoint do not have an arrival time by shifting
 * the startTime and the arrival time of all the other waypoints.
 *
 * This is necessary because our backend API do not allow the first
 * waypoint to have an arrival time.
 */
function normalizeFirstWaypointTimes(
  pathSteps: PathStep[],
  startTime: number
): { pathSteps: PathStep[]; startTime: number } {
  const firstArrival = pathSteps[0]?.arrival;
  if (!firstArrival) return { pathSteps, startTime };

  const shiftedPathSteps = pathSteps.map((step, index) => {
    if (index === 0) return { ...step, arrival: null };
    if (step.arrival) return { ...step, arrival: step.arrival.sub(firstArrival) };
    return step;
  });

  return { pathSteps: shiftedPathSteps, startTime: startTime + firstArrival.ms };
}

export function formatTrainSchedulePayload(osrdconf: OperationalStudiesConfState): TrainSchedule {
  const { pathSteps, startTime } = normalizeFirstWaypointTimes(
    compact(osrdconf.pathSteps),
    osrdconf.startTime.getTime()
  );

  return {
    category: osrdconf.category,
    comfort: osrdconf.rollingStockComfort,
    constraint_distribution: osrdconf.constraintDistribution,
    initial_speed: osrdconf.initialSpeed ? kmhToMs(osrdconf.initialSpeed) : 0,
    labels: osrdconf.labels,
    margins: formatMargin(pathSteps),
    options: {
      use_electrical_profiles: osrdconf.usingElectricalProfiles,
      use_speed_limits_for_simulation: osrdconf.usingSpeedLimits,
      stops_at_end_of_block: false,
    },
    path: pathSteps.map((step) => ({
      id: step.id,
      location: step.location,
    })),
    paced:
      osrdconf.editingTrainType !== 'uniqueTrain'
        ? {
            time_window: osrdconf.timeWindow.toISOString(),
            interval: osrdconf.interval.toISOString(),
            // This data is used as payload to create/update train schedule and shouldn't have exceptions inside
            // since exceptions have their own endpoints for that
            exceptions: [],
          }
        : undefined,
    power_restrictions: osrdconf.powerRestriction,
    rolling_stock_name: osrdconf.rollingStockName,
    schedule: formatSchedule(pathSteps),
    speed_limit_tag: osrdconf.speedLimitByTag,
    start_time: startTime,
    train_name: osrdconf.name,
  };
}

// Format a TrainScheduleWithDetails to a TrainSchedule payload by keeping only the
// necessary properties and formatting the date fields to ISO strings.
export function formatTrainScheduleWithDetailsToTrainSchedule(
  trainScheduleWithDetails: TrainScheduleWithDetails
): TrainSchedule {
  return {
    category: trainScheduleWithDetails.category,
    comfort: trainScheduleWithDetails.comfort,
    constraint_distribution: trainScheduleWithDetails.constraint_distribution,
    initial_speed: trainScheduleWithDetails.initial_speed,
    labels: trainScheduleWithDetails.labels,
    margins: trainScheduleWithDetails.margins,
    options: trainScheduleWithDetails.options,
    paced: trainScheduleWithDetails.paced
      ? {
          time_window: trainScheduleWithDetails.paced.timeWindow.toISOString(),
          interval: trainScheduleWithDetails.paced.interval.toISOString(),
          // This data is used as payload to create/update train schedule and shouldn't have exceptions inside
          // since exceptions have their own endpoints for that
          exceptions: [],
        }
      : undefined,
    path: trainScheduleWithDetails.path,
    power_restrictions: trainScheduleWithDetails.power_restrictions,
    // Rollingstock is missing when just created a train from nge or with import
    rolling_stock_name:
      trainScheduleWithDetails.rollingStock?.name ?? trainScheduleWithDetails.rollingStockName,
    schedule: trainScheduleWithDetails.schedule,
    speed_limit_tag: trainScheduleWithDetails.speed_limit_tag,
    start_time: startTimeToMs(trainScheduleWithDetails.startTime),
    train_name: trainScheduleWithDetails.name,
  };
}

/**
 * Used when editing an occurrence of a paced train.
 * Generates the exception diff for the occurrence being modified and returns it
 * alongside the existing exception if any.
 * The caller is responsible for creating/updating the exception and updating the list.
 */
export function formatOccurrenceException(
  train: TrainSchedule,
  originalPacedTrain: PacedTrainWithDetails,
  occurrenceId: OccurrenceId
): {
  generatedException: Omit<PacedTrainException, 'key' | 'occurrence_index'>;
  occurrenceIndex: number | undefined;
} {
  const originalTrainSchedule = formatTrainScheduleWithDetailsToTrainSchedule(originalPacedTrain);

  if (!isPacedTrainBase(originalTrainSchedule))
    throw new Error(
      `TrainSchedule payload (built from train ${originalPacedTrain.id}) should have a paced field.`
    );

  const occurrenceIndex = isIndexedOccurrenceId(occurrenceId)
    ? extractOccurrenceIndexFromOccurrenceId(occurrenceId)
    : undefined;

  const generatedException = generatePacedTrainException(
    train,
    originalTrainSchedule,
    occurrenceIndex
  );

  return { generatedException, occurrenceIndex };
}
