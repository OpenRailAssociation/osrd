import { useMemo } from 'react';

import dayjs from 'dayjs';
import { omit, sortBy } from 'lodash';

import computeOccurrenceName from 'modules/trainschedule/helpers/computeOccurrenceName';
import {
  findExceptionWithOccurrenceId,
  getOccurrencesNb,
} from 'modules/trainschedule/helpers/pacedTrain';
import {
  formatPacedTrainIdToExceptionId,
  formatPacedTrainIdToIndexedOccurrenceId,
} from 'utils/trainId';

import type { Occurrence, PacedTrainWithDetails } from '../../types';

type OccurrencesState = {
  occurrences: Occurrence[];
  occurrencesCount: number;
};

const useOccurrences = (pacedTrain: PacedTrainWithDetails) => {
  const {
    id,
    paced,
    startTime,
    arrivalTime,
    name,
    rollingStock,
    stopsCount,
    mechanicalEnergyConsumed,
    pathLength,
    duration,
    isValid,
    exceptions,
  } = pacedTrain;
  const occurrencesState = useMemo<OccurrencesState>(() => {
    const occurrencesCount = getOccurrencesNb(paced);
    const computedOccurrences: Occurrence[] = [];

    // Handle indexed occurrences
    for (let i = 0; i < occurrencesCount; i += 1) {
      const occurrenceId = formatPacedTrainIdToIndexedOccurrenceId(id, i);
      const occurrenceStartTime = dayjs(startTime)
        .add(i * paced.interval.ms, 'ms')
        .toDate();
      const occurrenceArrivalTime = dayjs(arrivalTime)
        .add(i * paced.interval.ms, 'ms')
        .toDate();
      const correspondingExceptions = findExceptionWithOccurrenceId(exceptions, occurrenceId);
      computedOccurrences.push({
        id: occurrenceId,
        trainName: computeOccurrenceName(name, i),
        rollingStock,
        startTime: occurrenceStartTime,
        stopsCount,
        disabled: correspondingExceptions?.disabled,
        occurrenceIndex: i,
        exceptions: correspondingExceptions
          ? omit(correspondingExceptions, ['key', 'occurrence_index', 'disabled'])
          : undefined,
        ...(isValid
          ? {
              isValid: true,
              // TODO exceptions : update the arrival time if the exception is in the paced train summaries
              arrivalTime: occurrenceArrivalTime,
              pathLength,
              mechanicalEnergyConsumed,
              duration,
            }
          : {
              isValid: false,
            }),
      });
    }

    // Handle added exceptions
    exceptions.forEach((exception, i) => {
      if (exception.occurrence_index !== undefined) return;

      computedOccurrences.push({
        id: formatPacedTrainIdToExceptionId(id, exception.key),
        // TODO exceptions : find a better way to generate added exception names
        trainName: computeOccurrenceName(name, occurrencesCount + i),
        rollingStock,
        // An added exception will always have a least a start time in its exceptions
        startTime: new Date(exception.start_time!.value),
        stopsCount,
        exceptions: omit(exception, ['key']),
        ...(isValid
          ? {
              isValid: true,
              // TODO exceptions : update the arrival time if the exception is in the paced train summaries
              arrivalTime: new Date(Date.parse(exception.start_time!.value) + duration!.ms),
              pathLength,
              mechanicalEnergyConsumed,
              duration,
            }
          : {
              isValid: false,
            }),
      });
    });

    const sortedOccurrences = sortBy(computedOccurrences, 'startTime');

    // TODO exceptions : update the count to display only active occurrences in issue https://github.com/OpenRailAssociation/osrd/issues/11470
    return { occurrencesCount: sortedOccurrences.length, occurrences: sortedOccurrences };
  }, [pacedTrain]);

  return occurrencesState;
};

export default useOccurrences;
