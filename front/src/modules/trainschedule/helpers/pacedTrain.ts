import type { PacedTrainException } from 'common/api/osrdEditoastApi';
import type { OccurrenceId } from 'reducers/osrdconf/types';
import {
  extractExceptionIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  isIndexedOccurrenceId,
} from 'utils/trainId';

import type { ExceptionChangeGroups, PacedTrainWithDetails } from '../components/Timetable/types';

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
  exceptionChangeGroups: ExceptionChangeGroups
) => {
  const updatedPacedTrain: PacedTrainWithDetails & { rollingStockName?: string } = pacedTrain;
  if (exceptionChangeGroups.train_name) {
    updatedPacedTrain.name = exceptionChangeGroups.train_name.value;
  }
  if (exceptionChangeGroups.start_time) {
    updatedPacedTrain.startTime = new Date(exceptionChangeGroups.start_time.value);
  }
  if (exceptionChangeGroups.speed_limit_tag) {
    // speed limit tag will always be a string or null
    updatedPacedTrain.speedLimitTag = exceptionChangeGroups.speed_limit_tag.value!;
  }
  if (exceptionChangeGroups.labels) {
    updatedPacedTrain.labels = exceptionChangeGroups.labels.value;
  }
  if (exceptionChangeGroups.initial_speed) {
    updatedPacedTrain.initial_speed = exceptionChangeGroups.initial_speed.value;
  }
  if (exceptionChangeGroups.constraint_distribution) {
    updatedPacedTrain.constraint_distribution = exceptionChangeGroups.constraint_distribution.value;
  }
  if (exceptionChangeGroups.rolling_stock_category) {
    updatedPacedTrain.category = exceptionChangeGroups.rolling_stock_category.value;
  }
  if (exceptionChangeGroups.rolling_stock) {
    updatedPacedTrain.comfort = exceptionChangeGroups.rolling_stock.comfort;
  }
  if (exceptionChangeGroups.path_and_schedule) {
    updatedPacedTrain.margins = exceptionChangeGroups.path_and_schedule.margins;
    updatedPacedTrain.path = exceptionChangeGroups.path_and_schedule.path;
    updatedPacedTrain.power_restrictions =
      exceptionChangeGroups.path_and_schedule.power_restrictions;
    updatedPacedTrain.schedule = exceptionChangeGroups.path_and_schedule.schedule;
  }
  if (exceptionChangeGroups.options) {
    // options is optional when creating a timetable item but
    // is always present when editing an existing one
    updatedPacedTrain.options!.use_electrical_profiles =
      exceptionChangeGroups.options.value?.use_electrical_profiles;
    updatedPacedTrain.options!.use_speed_limits_for_simulation =
      exceptionChangeGroups.options.value?.use_speed_limits_for_simulation;
  }
  return updatedPacedTrain;
};
