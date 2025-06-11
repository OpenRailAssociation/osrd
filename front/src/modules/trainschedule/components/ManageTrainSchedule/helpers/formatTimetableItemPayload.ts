import { compact } from 'lodash';

import type { PacedTrain, TrainSchedule } from 'common/api/osrdEditoastApi';
import getStepLocation from 'modules/pathfinding/helpers/getStepLocation';
import type {
  TimetableItemToEditData,
  OperationalStudiesConfState,
  PacedTrainId,
} from 'reducers/osrdconf/types';
import { kmhToMs } from 'utils/physics';
import { isPacedTrainId } from 'utils/trainId';

import {
  generatePacedTrainException,
  updatePacedTrainExceptionsList,
  checkChangeGroups,
} from './buildPacedTrainException';
import formatMargin from './formatMargin';
import formatSchedule from './formatSchedule';
import type { PacedTrainWithDetails } from '../../Timetable/types';

export function formatTimetableItemPayload(
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
    },
    path: compact(osrdconf.pathSteps).map((step) => ({
      id: step.id,
      ...getStepLocation(step),
      deleted: step.deleted || false,
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
): PacedTrain {
  return {
    category: pacedTrainWithDetails.category,
    comfort: pacedTrainWithDetails.comfort,
    constraint_distribution: pacedTrainWithDetails.constraint_distribution,
    exceptions: pacedTrainWithDetails.exceptions,
    initial_speed: pacedTrainWithDetails.initial_speed,
    labels: pacedTrainWithDetails.labels,
    margins: pacedTrainWithDetails.margins,
    options: pacedTrainWithDetails.options,
    paced: {
      time_window: pacedTrainWithDetails.paced.timeWindow.toISOString(),
      interval: pacedTrainWithDetails.paced.interval.toISOString(),
    },
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

function isPacedTrainToEditData(
  timetableItemToEditData: TimetableItemToEditData
): timetableItemToEditData is Extract<TimetableItemToEditData, { timetableItemId: PacedTrainId }> {
  return isPacedTrainId(timetableItemToEditData.timetableItemId);
}

/**
 * Used when creating and editing a paced train
 * @param osrdconf pace train fields that were modified by user
 * @param timetableItemToEditData the existing paced train we’re editing
 */
export function formatPacedTrainPayload(
  osrdconf: OperationalStudiesConfState,
  // TODO TS2 : remove this when rollingStockName will replace rollingStockId in the store
  rollingStockName: string,
  timetableItemToEditData?: TimetableItemToEditData
): PacedTrain {
  const baseTrain = formatTimetableItemPayload(osrdconf, rollingStockName);

  const exceptions = osrdconf.addedExceptions.map(({ key, startTime }) => ({
    key,
    start_time: { value: startTime.toISOString() },
  }));
  let newPacedTrain: PacedTrain = {
    ...baseTrain,
    paced: {
      time_window: osrdconf.timeWindow.toISOString(),
      interval: osrdconf.interval.toISOString(),
    },
    exceptions,
  };

  // ========== Editing a pacedtrain ==========
  if (timetableItemToEditData && isPacedTrainToEditData(timetableItemToEditData)) {
    const originalPacedTrain = formatPacedTrainWithDetailsToPacedTrainPayload(
      timetableItemToEditData.originalPacedTrain
    );
    if (timetableItemToEditData.occurrenceId) {
      // === user modified an occurrence ===
      const exception = generatePacedTrainException(
        newPacedTrain, // contains occurrence changes
        originalPacedTrain,
        timetableItemToEditData.occurrenceId
      );

      const updatedExceptions = updatePacedTrainExceptionsList(
        originalPacedTrain.exceptions,
        exception,
        timetableItemToEditData.occurrenceId
      );
      // If we are updating an occurrence, we want to send the exact same original paced train
      // with only its exceptions updated
      newPacedTrain = {
        ...originalPacedTrain,
        exceptions: updatedExceptions,
      };
    } else {
      // === user modified the whole paced train ===
      const updatedExceptions = checkChangeGroups(newPacedTrain, originalPacedTrain.exceptions);

      newPacedTrain = {
        ...newPacedTrain,
        exceptions: updatedExceptions,
      };
    }
  }
  return newPacedTrain;
}
