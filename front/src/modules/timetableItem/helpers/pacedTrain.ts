import type { PacedTrain, PacedTrainException } from 'common/api/osrdEditoastApi';
import { isMainCategory } from 'modules/rollingStock/helpers/utils';
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

export const extractOccurrenceDetailsFromPacedTrain = <
  T extends Omit<PacedTrain, 'paced' | 'exceptions'>,
>(
  pacedTrain: T,
  exceptionChangeGroups: ExceptionChangeGroups
) => {
  const occurrence = { ...pacedTrain };

  if (exceptionChangeGroups.train_name) {
    occurrence.train_name = exceptionChangeGroups.train_name.value;
  }
  if (exceptionChangeGroups.start_time) {
    occurrence.start_time = exceptionChangeGroups.start_time.value;
  }
  if (exceptionChangeGroups.speed_limit_tag) {
    // speed limit tag will always be a string or null
    occurrence.speed_limit_tag = exceptionChangeGroups.speed_limit_tag.value!;
  }
  if (exceptionChangeGroups.labels) {
    occurrence.labels = exceptionChangeGroups.labels.value;
  }
  if (exceptionChangeGroups.initial_speed) {
    occurrence.initial_speed = exceptionChangeGroups.initial_speed.value;
  }
  if (exceptionChangeGroups.constraint_distribution) {
    occurrence.constraint_distribution = exceptionChangeGroups.constraint_distribution.value;
  }
  if (exceptionChangeGroups.rolling_stock_category) {
    occurrence.category =
      exceptionChangeGroups.rolling_stock_category.value &&
      isMainCategory(exceptionChangeGroups.rolling_stock_category.value)
        ? {
            main_category: exceptionChangeGroups.rolling_stock_category.value.main_category,
          }
        : undefined;
  }
  if (exceptionChangeGroups.rolling_stock) {
    occurrence.rolling_stock_name = exceptionChangeGroups.rolling_stock.rolling_stock_name;
    occurrence.comfort = exceptionChangeGroups.rolling_stock.comfort;
  }
  if (exceptionChangeGroups.path_and_schedule) {
    occurrence.margins = exceptionChangeGroups.path_and_schedule.margins;
    occurrence.path = exceptionChangeGroups.path_and_schedule.path;
    occurrence.power_restrictions = exceptionChangeGroups.path_and_schedule.power_restrictions;
    occurrence.schedule = exceptionChangeGroups.path_and_schedule.schedule;
  }
  if (exceptionChangeGroups.options) {
    // options is optional when creating a timetable item but
    // is always present when editing an existing one
    occurrence.options!.use_electrical_profiles =
      exceptionChangeGroups.options.value?.use_electrical_profiles;
    occurrence.options!.use_speed_limits_for_simulation =
      exceptionChangeGroups.options.value?.use_speed_limits_for_simulation;
  }
  return occurrence;
};
