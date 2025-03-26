import { useMemo } from 'react';

import dayjs from 'dayjs';

import computeOccurrenceName from 'modules/trainschedule/helpers/computeOccurrenceName';
import type { OccurrenceId } from 'reducers/osrdconf/types';

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
}: PacedTrainWithDetails) => {
  const occurrencesState = useMemo<OccurrencesState>(() => {
    const occurrencesCount = Math.ceil(paced.duration.ms / paced.step.ms);
    const computedOccurrences: Occurrence[] = [];

    for (let i = 0; i < occurrencesCount; i += 1) {
      const occurrenceStartTime = dayjs(startTime)
        .add(i * paced.step.ms, 'ms')
        .toDate();
      const occurrenceArrivalTime = dayjs(arrivalTime)
        .add(i * paced.step.ms, 'ms')
        .toDate();
      computedOccurrences.push({
        id: `occurrence-${i}-${id}` as OccurrenceId,
        trainName: computeOccurrenceName(name, i),
        rollingStock,
        startTime: occurrenceStartTime,
        arrivalTime: occurrenceArrivalTime,
      });
    }
    return { occurrencesCount, occurrences: computedOccurrences };
  }, [paced.duration, paced.step, startTime, arrivalTime, name, id, rollingStock]);

  return occurrencesState;
};

export default useOccurrences;
