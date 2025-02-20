import { useState, useEffect } from 'react';

import dayjs from 'dayjs';

import { type Duration } from 'utils/duration';

import type { PacedTrainWithResult } from '../../types';
import type { Occurrence } from '../OccurrenceItem';

type OccurrencesState = {
  occurrences: Occurrence[];
  occurrencesCount: number;
};

const useOccurrences = (pacedTrain: PacedTrainWithResult, stepDuration: Duration) => {
  const [occurrencesState, setOccurrencesState] = useState<OccurrencesState>({
    occurrences: [],
    occurrencesCount: 0,
  });

  useEffect(() => {
    const computeOccurrences = (): OccurrencesState => {
      const occurrencesCount = Math.floor(pacedTrain.paced.duration.ms / pacedTrain.paced.step.ms);
      const computedOccurrences = [];
      for (let i = 0; i < occurrencesCount; i += 1) {
        const startTime = dayjs(pacedTrain.startTime)
          .add(i * stepDuration.ms, 'ms')
          .toDate();
        const arrivalTime = dayjs(pacedTrain.startTime)
          .add((i + 1) * stepDuration.ms, 'ms')
          .toDate();
        computedOccurrences.push({
          id: `occurrence-${i}-paced-${pacedTrain.id}`,
          trainName: pacedTrain.trainName,
          rollingStock: pacedTrain.rollingStock,
          startTime,
          arrivalTime,
        });
      }
      return { occurrencesCount, occurrences: computedOccurrences };
    };

    setOccurrencesState(computeOccurrences());
  }, [pacedTrain]);

  return occurrencesState;
};

export default useOccurrences;
