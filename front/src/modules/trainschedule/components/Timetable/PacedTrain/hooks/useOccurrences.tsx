import { useMemo } from 'react';

import dayjs from 'dayjs';

import computeOccurrenceName from 'modules/trainschedule/helpers/computeOccurrenceName';
import { getOccurrencesNb } from 'modules/trainschedule/helpers/pacedTrain';
import { formatPacedTrainIdToOccurrenceId } from 'utils/trainId';

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
}: PacedTrainWithDetails) => {
  const occurrencesState = useMemo<OccurrencesState>(() => {
    const occurrencesCount = getOccurrencesNb(paced);
    const computedOccurrences: Occurrence[] = [];

    for (let i = 0; i < occurrencesCount; i += 1) {
      const occurrenceStartTime = dayjs(startTime)
        .add(i * paced.interval.ms, 'ms')
        .toDate();
      const occurrenceArrivalTime = dayjs(arrivalTime)
        .add(i * paced.interval.ms, 'ms')
        .toDate();
      computedOccurrences.push({
        id: formatPacedTrainIdToOccurrenceId(id, i),
        trainName: computeOccurrenceName(name, i),
        rollingStock,
        startTime: occurrenceStartTime,
        stopsCount,
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
