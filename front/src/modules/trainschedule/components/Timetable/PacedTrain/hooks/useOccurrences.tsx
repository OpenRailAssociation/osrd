import { useMemo } from 'react';

import dayjs from 'dayjs';

import type { OccurrenceId } from 'reducers/osrdconf/types';

import type { Occurrence, PacedTrainWithResult } from '../../types';

export const computeOccurrenceName = (pacedTrainName: string, index: number): string => {
  const endByNumber = /\b\w+\s\d+$/;

  if (endByNumber.test(pacedTrainName)) {
    const endOfPacedTrainName = Number(pacedTrainName.split(' ').pop());
    return `${pacedTrainName.replace(/\s\d+$/, '')} ${endOfPacedTrainName + 2 * index}`;
  }
  if (!Number.isNaN(+pacedTrainName)) {
    return `${+pacedTrainName + 2 * index}`;
  }
  return `${pacedTrainName} ${2 * index + 1}`;
};

type OccurrencesState = {
  occurrences: Occurrence[];
  occurrencesCount: number;
};

const useOccurrences = ({
  id,
  paced,
  startTime,
  arrivalTime,
  trainName,
  rollingStock,
}: PacedTrainWithResult) => {
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
        trainName: computeOccurrenceName(trainName, i),
        rollingStock,
        startTime: occurrenceStartTime,
        arrivalTime: occurrenceArrivalTime,
      });
    }
    return { occurrencesCount, occurrences: computedOccurrences };
  }, [paced.duration, paced.step, startTime, arrivalTime, trainName, id, rollingStock]);

  return occurrencesState;
};

export default useOccurrences;
