/* eslint-disable import/prefer-default-export */
import { useEffect, useState } from 'react';

import type {
  OperationalPointWithTimeAndSpeed,
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';

import { formatOperationalPoints } from '../SimulationResultExport/utils';

/**
 * add time, speed, position, duration to operational points
 */
export const useFormattedOperationalPoints = (
  train?: TrainScheduleBase,
  simulatedTrain?: SimulationResponseSuccess,
  pathProperties?: PathPropertiesFormatted,
  infraId?: number
) => {
  const [operationalPoints, setOperationalPoints] = useState<OperationalPointWithTimeAndSpeed[]>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (train && simulatedTrain && pathProperties && infraId) {
      const fetchOperationalPoints = async () => {
        setLoading(true);
        const formattedOperationalPoints = await formatOperationalPoints(
          pathProperties.operationalPoints,
          simulatedTrain,
          train,
          infraId
        );
        setOperationalPoints(formattedOperationalPoints);
        setLoading(false);
      };
      fetchOperationalPoints();
    }
  }, [train, simulatedTrain, pathProperties, infraId]);

  return { operationalPoints, loading };
};
