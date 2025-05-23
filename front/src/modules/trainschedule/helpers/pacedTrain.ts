import type { PacedTrainException } from 'common/api/osrdEditoastApi';
import type { OccurrenceId } from 'reducers/osrdconf/types';
import {
  extractExceptionIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  isIndexedOccurrenceId,
} from 'utils/trainId';

import type { OccurrenceException, PacedTrainWithDetails } from '../components/Timetable/types';

export const getOccurrencesNb = ({ timeWindow, interval }: PacedTrainWithDetails['paced']) => {
  if (interval.ms === 0) {
    throw new Error('Interval cannot be 0');
  }
  return Math.ceil(timeWindow.ms / interval.ms);
};

/**
 * Based on an exception list and an occurrence id, find the corresponding exception
 */
export const findExceptionWithOccurrenceId = (
  exceptions: PacedTrainException[],
  occurrenceId: OccurrenceId
) => {
  if (isIndexedOccurrenceId(occurrenceId)) {
    const occurrenceToUpdateIndex = extractOccurrenceIndexFromOccurrenceId(occurrenceId);

    return exceptions.find((exception) => exception.occurrence_index === occurrenceToUpdateIndex);
  }
  const addedExceptionId = extractExceptionIdFromOccurrenceId(occurrenceId);
  return exceptions.find(({ key }) => addedExceptionId === key);
};

export const formatPacedTrainWithOccurenceDetails = (
  pacedTrain: PacedTrainWithDetails,
  exceptions: OccurrenceException
) => {
  const updatedPacedTrain: PacedTrainWithDetails & { rollingStockName?: string } = pacedTrain;
  if (exceptions.train_name) {
    updatedPacedTrain.name = exceptions.train_name.value;
  }
  if (exceptions.start_time) {
    updatedPacedTrain.startTime = new Date(exceptions.start_time.value);
  }
  if (exceptions.speed_limit_tag) {
    // speed limit tag will always be a string or null
    updatedPacedTrain.speedLimitTag = exceptions.speed_limit_tag.value!;
  }
  if (exceptions.labels) {
    updatedPacedTrain.labels = exceptions.labels.value;
  }
  if (exceptions.initial_speed) {
    updatedPacedTrain.initial_speed = exceptions.initial_speed.value;
  }
  if (exceptions.constraint_distribution) {
    updatedPacedTrain.constraint_distribution = exceptions.constraint_distribution.value;
  }
  if (exceptions.rolling_stock_category) {
    updatedPacedTrain.category = exceptions.rolling_stock_category.value;
  }
  if (exceptions.rolling_stock) {
    updatedPacedTrain.comfort = exceptions.rolling_stock.comfort;
  }
  if (exceptions.path_and_schedule) {
    updatedPacedTrain.margins = exceptions.path_and_schedule.margins;
    updatedPacedTrain.path = exceptions.path_and_schedule.path;
    updatedPacedTrain.power_restrictions = exceptions.path_and_schedule.power_restrictions;
    updatedPacedTrain.schedule = exceptions.path_and_schedule.schedule;
  }
  if (exceptions.options) {
    // options is optional when creating a timetable item but
    // is always present when editing an existing one
    updatedPacedTrain.options!.use_electrical_profiles =
      exceptions.options.value?.use_electrical_profiles;
    updatedPacedTrain.options!.use_speed_limits_for_simulation =
      exceptions.options.value?.use_speed_limits_for_simulation;
  }
  return updatedPacedTrain;
};
