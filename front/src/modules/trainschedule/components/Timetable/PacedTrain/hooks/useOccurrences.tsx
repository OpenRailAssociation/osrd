import { useMemo } from 'react';

import dayjs from 'dayjs';
import { omit } from 'lodash';

import computeOccurrenceName from 'modules/trainschedule/helpers/computeOccurrenceName';
import {
  findExceptionWithOccurrenceId,
  getOccurrencesNb,
} from 'modules/trainschedule/helpers/pacedTrain';
import { formatPacedTrainIdToIndexedOccurrenceId } from 'utils/trainId';

import type { Occurrence, PacedTrainWithDetails } from '../../types';

type OccurrencesState = {
  occurrences: Occurrence[];
  occurrencesCount: number;
};

const useOccurrences = ({
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
}: PacedTrainWithDetails) => {
  const occurrencesState = useMemo<OccurrencesState>(() => {
    const occurrencesCount = getOccurrencesNb(paced);
    const computedOccurrences: Occurrence[] = [];

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
    return { occurrencesCount, occurrences: computedOccurrences };
  }, [paced.timeWindow, paced.interval, startTime, arrivalTime, name, id, rollingStock]);

  return occurrencesState;
};

export default useOccurrences;
