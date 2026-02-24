import { compact } from 'lodash';
import { v4 as uuidV4 } from 'uuid';

import type { PacedTrainWithPaced } from 'applications/operationalStudies/types';
import type { PacedTrainException, TrainSchedule } from 'common/api/osrdEditoastApi';
import getStepLocation from 'modules/pathfinding/helpers/getStepLocation';
import {
  findExceptionWithOccurrenceId,
  isPacedTrainBase,
} from 'modules/timetableItem/helpers/pacedTrain';
import type { PacedTrainWithDetails } from 'modules/timetableItem/types';
import type {
  TimetableItemToEditData,
  OperationalStudiesConfState,
  PacedTrainId,
} from 'reducers/osrdconf/types';
import { kmhToMs } from 'utils/physics';
import {
  extractOccurrenceIndexFromOccurrenceId,
  isIndexedOccurrenceId,
  isPacedTrainId,
} from 'utils/trainId';

import {
  generatePacedTrainException,
  updatePacedTrainExceptionsList,
  checkChangeGroups,
} from './buildPacedTrainException';
import formatMargin from './formatMargin';
import formatSchedule from './formatSchedule';

export function formatTimetableItemPayload(
  osrdconf: OperationalStudiesConfState,
  // TODO TS2 : remove this when rollingStockName will replace rollingStockId in the store
  rollingStockName: string
): {
  newTrainSchedulePayload: TrainSchedule;
  updatedExceptions: PacedTrainException[];
} {
  return {
    newTrainSchedulePayload: {
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
    },
    updatedExceptions: [],
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
          exceptions: pacedTrainWithDetails.paced.exceptions,
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

export function isPacedTrainToEditData(
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
): {
  newTrainSchedulePayload: TrainSchedule;
  updatedExceptions: PacedTrainException[];
} {
  const { newTrainSchedulePayload: baseTrain } = formatTimetableItemPayload(
    osrdconf,
    rollingStockName
  );

  if (osrdconf.editingItemType === 'uniqueTrain')
    return { newTrainSchedulePayload: baseTrain, updatedExceptions: [] };

  const exceptions = osrdconf.addedExceptions.map(({ key, startTime }) => ({
    key,
    start_time: { value: startTime.toISOString() },
  }));
  let newPacedTrain: Omit<PacedTrainWithPaced, 'train_schedule_set_id'> = {
    ...baseTrain,
    paced: {
      time_window: osrdconf.timeWindow.toISOString(),
      interval: osrdconf.interval.toISOString(),
      exceptions,
    },
  };

  if (
    timetableItemToEditData &&
    isPacedTrainToEditData(timetableItemToEditData) &&
    timetableItemToEditData.originalPacedTrain.paced
  ) {
    const originalPacedTrain = formatPacedTrainWithDetailsToPacedTrainPayload(
      timetableItemToEditData.originalPacedTrain
    );
    if (!isPacedTrainBase(originalPacedTrain))
      throw new Error(
        `PacedTrain payload (built from train ${timetableItemToEditData.originalPacedTrain.id}) should have a paced field.`
      );

    // ========== user modified an occurrence ==========
    if (timetableItemToEditData.occurrenceId) {
      const occurrenceIndex = isIndexedOccurrenceId(timetableItemToEditData.occurrenceId)
        ? extractOccurrenceIndexFromOccurrenceId(timetableItemToEditData.occurrenceId)
        : undefined;

      const baseException = generatePacedTrainException(
        newPacedTrain, // contains occurrence changes
        originalPacedTrain,
        occurrenceIndex
      );

      const existingException = findExceptionWithOccurrenceId(
        originalPacedTrain.paced.exceptions,
        timetableItemToEditData.occurrenceId
      );

      const updatedExceptions = updatePacedTrainExceptionsList(
        originalPacedTrain.paced.exceptions,
        {
          ...baseException,
          key: existingException?.key ?? uuidV4(),
          occurrence_index: occurrenceIndex,
        },
        timetableItemToEditData.occurrenceId
      );
      // If we are updating an occurrence, we want to send the exact same original paced train
      // with only its exceptions updated
      newPacedTrain = {
        ...originalPacedTrain,
        paced: { ...originalPacedTrain.paced, exceptions: updatedExceptions },
      };
      // ========== user modified the whole paced train ==========
    } else {
      const hasPacedTrainSettingsChanged =
        osrdconf.timeWindow.toISOString() !==
          timetableItemToEditData.originalPacedTrain.paced.timeWindow.toISOString() ||
        osrdconf.interval.toISOString() !==
          timetableItemToEditData.originalPacedTrain.paced.interval.toISOString();

      // Reset all exceptions if the paced train settings have changed
      const newExceptionList = !hasPacedTrainSettingsChanged
        ? [
            ...checkChangeGroups(
              newPacedTrain,
              newPacedTrain.paced,
              originalPacedTrain.paced.exceptions
            ),
            ...newPacedTrain.paced.exceptions,
          ]
        : [];

      newPacedTrain = {
        ...newPacedTrain,
        paced: { ...newPacedTrain.paced, exceptions: newExceptionList },
      };
    }
  }
  return { newTrainSchedulePayload: newPacedTrain, updatedExceptions: exceptions };
}
