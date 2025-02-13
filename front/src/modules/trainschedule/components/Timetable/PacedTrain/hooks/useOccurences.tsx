import { useState, useEffect } from 'react';

import dayjs from 'dayjs';

import { Duration } from 'utils/duration';

import type { Occurence } from '../OccurenceItem';
import type { PacedTrain } from '../PacedTrainItem';

type OccurencesState = {
  occurences: Occurence[];
  occurencesCount: number;
};

const useOccurences = (pacedTrain: PacedTrain, stepDuration: Duration) => {
  const [occurencesState, setOccurencesState] = useState<OccurencesState>({
    occurences: [],
    occurencesCount: 0,
  });

  useEffect(() => {
    const computeOccurences = (): OccurencesState => {
      const occurencesCount = Math.floor(
        (Duration.parse(pacedTrain.paced.duration).ms - 6000) /
          Duration.parse(pacedTrain.paced.step).ms
      );
      const computedOccurences = [];
      for (let i = 0; i < occurencesCount; i += 1) {
        const startTime = dayjs(pacedTrain.startTime)
          .add(i * stepDuration.ms, 'ms')
          .toDate();
        const arrivalTime = dayjs(pacedTrain.startTime)
          .add((i + 1) * stepDuration.ms, 'ms')
          .toDate();
        computedOccurences.push({
          id: `occurence-${i}-paced-${pacedTrain.id}`,
          trainName: pacedTrain.trainName,
          rollingStock: pacedTrain.rollingStock,
          startTime,
          arrivalTime,
        });
      }
      return { occurencesCount, occurences: computedOccurences };
    };

    setOccurencesState(computeOccurences());
  }, [pacedTrain]);

  return occurencesState;
};

export default useOccurences;
