import { compact } from 'lodash';

import type { PacedTrainWithPaced } from 'applications/operationalStudies/types';
import type { PacedTrainException, TrainSchedule } from 'common/api/osrdEditoastApi';
import getStepLocation from 'modules/pathfinding/helpers/getStepLocation';
import { isPacedTrainBase } from 'modules/timetableItem/helpers/pacedTrain';
import type { PacedTrainWithDetails } from 'modules/timetableItem/types';
import type { TrainScheduleToEditData, OperationalStudiesConfState } from 'reducers/osrdconf/types';
import { kmhToMs } from 'utils/physics';
import { extractOccurrenceIndexFromOccurrenceId, isIndexedOccurrenceId } from 'utils/trainId';
import type { NonNullableObject } from 'utils/types';

import { generatePacedTrainException } from './buildPacedTrainException';
import formatMargin from './formatMargin';
import formatSchedule from './formatSchedule';

export function formatTrainSchedulePayload(
  osrdconf: OperationalStudiesConfState,
  // TODO TS2 : remove this when rollingStockName will replace rollingStockId in the store
  rollingStockName: string
): TrainSchedule {
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
      location: getStepLocation(step.location),
    })),
    power_restrictions: osrdconf.powerRestriction,
    rolling_stock_name: rollingStockName,
    schedule: formatSchedule(compact(osrdconf.pathSteps)),
    speed_limit_tag: osrdconf.speedLimitByTag,
    start_time: osrdconf.startTime.toISOString(),
    train_name: osrdconf.name,
  };
}

// Format a PacedTrainWithDetails to a PacedTrain payload by keeping only the
// necessary properties and formatting the date fields to ISO strings.
export function formatPacedTrainWithDetailsToPacedTrainPayload(
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
    start_time: pacedTrainWithDetails.startTime.toISOString(),
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
  osrdconf: OperationalStudiesConfState,
  rollingStockName: string,
  trainScheduleToEditData: NonNullableObject<TrainScheduleToEditData, 'occurrenceId'>
): {
  generatedException: Omit<PacedTrainException, 'key' | 'occurrence_index'>;
  occurrenceIndex: number | undefined;
} {
  const baseTrain = formatTrainSchedulePayload(osrdconf, rollingStockName);

  const newPacedTrain: Omit<PacedTrainWithPaced, 'train_schedule_set_id'> = {
    ...baseTrain,
    paced: {
      time_window: osrdconf.timeWindow.toISOString(),
      interval: osrdconf.interval.toISOString(),
      exceptions: [],
    },
  };

  const originalPacedTrain = formatPacedTrainWithDetailsToPacedTrainPayload(
    trainScheduleToEditData.originalPacedTrain
  );

  if (!isPacedTrainBase(originalPacedTrain))
    throw new Error(
      `PacedTrain payload (built from train ${trainScheduleToEditData.originalPacedTrain.id}) should have a paced field.`
    );

  const { occurrenceId } = trainScheduleToEditData;

  const occurrenceIndex = isIndexedOccurrenceId(occurrenceId)
    ? extractOccurrenceIndexFromOccurrenceId(occurrenceId)
    : undefined;

  const generatedException = generatePacedTrainException(
    newPacedTrain,
    originalPacedTrain,
    occurrenceIndex
  );

  return { generatedException, occurrenceIndex };
}

/**
 * Used when creating and editing a paced train (not an occurrence).
 * @param osrdconf paced train fields that were modified by user
 */
export function formatPacedTrainPayload(
  osrdconf: OperationalStudiesConfState,
  // TODO TS2 : remove this when rollingStockName will replace rollingStockId in the store
  rollingStockName: string
): TrainSchedule {
  const baseTrain = formatTrainSchedulePayload(osrdconf, rollingStockName);

  if (osrdconf.editingTrainType === 'uniqueTrain') return baseTrain;

  const newPacedTrain: Omit<PacedTrainWithPaced, 'train_schedule_set_id'> = {
    ...baseTrain,
    paced: {
      time_window: osrdconf.timeWindow.toISOString(),
      interval: osrdconf.interval.toISOString(),
      // This data is used as payload to create/update train schedule and shouldn't have exceptions inside
      // since exceptions have their own endpoints for that
      exceptions: [],
    },
  };

  return newPacedTrain;
}
