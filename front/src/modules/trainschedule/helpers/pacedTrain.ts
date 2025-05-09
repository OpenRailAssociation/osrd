import type { PacedTrainException } from 'common/api/osrdEditoastApi';
import type { OccurrenceId } from 'reducers/osrdconf/types';
import {
  extractExceptionIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  isIndexedOccurrenceId,
} from 'utils/trainId';

import { exceptionChangeGroupsDict } from '../components/Timetable/consts';
import type {
  ExceptionChangeGroup,
  OccurrenceException,
  PacedTrainWithDetails,
} from '../components/Timetable/types';

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

export const getExceptionChangeGroups = (
  pacedTrainExceptions: OccurrenceException
): ExceptionChangeGroup[] =>
  Object.keys(pacedTrainExceptions).map(
    (exception) => exceptionChangeGroupsDict[exception as keyof OccurrenceException]
  );
