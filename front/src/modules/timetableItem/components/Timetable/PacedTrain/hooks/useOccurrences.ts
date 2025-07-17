import { useMemo } from 'react';

import { type LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';

import type { PacedTrainWithDetails } from '../../types';
import { generatePacedTrainOccurrences } from '../../utils';

const useOccurrences = (
  pacedTrain: PacedTrainWithDetails,
  rollingStockList: LightRollingStockWithLiveries[] | null
) => {
  const { exceptions } = pacedTrain;

  const occurrences = useMemo(
    () => generatePacedTrainOccurrences(pacedTrain, rollingStockList),
    [pacedTrain, rollingStockList]
  );

  // Add to the count the added exceptions and substract the disabled ones
  const occurrenceCountLabel = useMemo(
    () =>
      exceptions.reduce((acc, exception) => {
        if (exception.disabled) acc -= 1;
        return acc;
      }, occurrences.length),
    [occurrences.length, exceptions]
  );
  return { occurrencesCount: occurrenceCountLabel, occurrences };
};

export default useOccurrences;
