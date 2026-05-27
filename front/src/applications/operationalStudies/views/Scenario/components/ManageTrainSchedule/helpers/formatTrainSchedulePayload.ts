import { compact } from 'lodash';

import type { PacedTrainException, TrainSchedule } from 'common/api/osrdEditoastApi';
import { isPacedTrainBase } from 'modules/trainSchedule/helpers/pacedTrain';
import type { PacedTrainWithDetails } from 'modules/trainSchedule/types';
import type { OperationalStudiesConfState, OccurrenceId } from 'reducers/osrdconf/types';
import { kmhToMs } from 'utils/physics';
import { extractOccurrenceIndexFromOccurrenceId, isIndexedOccurrenceId } from 'utils/trainId';

import { generatePacedTrainException } from './buildPacedTrainException';
import formatMargin from './formatMargin';
import formatSchedule from './formatSchedule';

export function formatTrainSchedulePayload(osrdconf: OperationalStudiesConfState): TrainSchedule {
  return {
    category: osrdconf.category,
    comfort: osrdconf.rollingStockComfort,
    constraint_distribution: osrdconf.constraintDistribution,
    initial_speed: osrdconf.initialSpeed ? kmhToMs(osrdconf.initialSpeed) : 0,
    labels: osrdconf.labels,
    margins: formatMargin(compact(osrdconf.pathSteps)),
    options: {
      use_electrical_profiles: osrdconf.usingElectricalProfiles,
      use_speed_limits_for_simulation: osrdconf.usingSpeedLimits,
      stops_at_end_of_block: false,
    },
    path: compact(osrdconf.pathSteps).map((step) => ({
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
    schedule: formatSchedule(compact(osrdconf.pathSteps)),
    speed_limit_tag: osrdconf.speedLimitByTag,
    start_time: osrdconf.startTime.getTime(),
    train_name: osrdconf.name,
  };
}

// Format a PacedTrainWithDetails to a TrainSchedule payload by keeping only the
// necessary properties and formatting the date fields to ISO strings.
export function formatPacedTrainWithDetailsToTrainSchedule(
  pacedTrainWithDetails: PacedTrainWithDetails
): TrainSchedule {
  return {
    category: pacedTrainWithDetails.category,
    comfort: pacedTrainWithDetails.comfort,
    constraint_distribution: pacedTrainWithDetails.constraint_distribution,
    initial_speed: pacedTrainWithDetails.initial_speed,
    labels: pacedTrainWithDetails.labels,
    margins: pacedTrainWithDetails.margins,
    options: pacedTrainWithDetails.options,
    paced: pacedTrainWithDetails.paced
      ? {
          time_window: pacedTrainWithDetails.paced.timeWindow.toISOString(),
          interval: pacedTrainWithDetails.paced.interval.toISOString(),
          // This data is used as payload to create/update train schedule and shouldn't have exceptions inside
          // since exceptions have their own endpoints for that
          exceptions: [],
        }
      : undefined,
    path: pacedTrainWithDetails.path,
    power_restrictions: pacedTrainWithDetails.power_restrictions,
    // Rollingstock is missing when just created a train from nge or with import
    rolling_stock_name: pacedTrainWithDetails.rollingStock?.name ?? '',
    schedule: pacedTrainWithDetails.schedule,
    speed_limit_tag: pacedTrainWithDetails.speed_limit_tag,
    start_time: pacedTrainWithDetails.startTime.getTime(),
    train_name: pacedTrainWithDetails.name,
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
  const originalTrainSchedule = formatPacedTrainWithDetailsToTrainSchedule(originalPacedTrain);

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
