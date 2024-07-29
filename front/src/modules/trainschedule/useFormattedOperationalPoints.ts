/* eslint-disable import/prefer-default-export */
import { useEffect, useState } from 'react';

import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';

import { BaseOrEco, type BaseOrEcoType } from './components/DriverTrainSchedule/consts';
import type { OperationalPointWithTimeAndSpeed } from './components/DriverTrainScheduleV2/types';
import { formatOperationalPoints, isEco } from './components/DriverTrainScheduleV2/utils';

/**
 * add time, speed, position, duration to operational points
 */
export const useFormattedOperationalPoints = (
  train?: TrainScheduleBase,
  simulatedTrain?: SimulationResponseSuccess,
  pathProperties?: PathPropertiesFormatted,
  infraId?: number
) => {
  const [operationalPoints, setOperationalPoints] = useState<OperationalPointWithTimeAndSpeed[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [baseOrEco, setBaseOrEco] = useState<BaseOrEcoType>(
    train && isEco(train) ? BaseOrEco.eco : BaseOrEco.base
  );

  useEffect(() => {
    if (train && simulatedTrain && pathProperties && infraId) {
      const selectedTrainRegime =
        baseOrEco === BaseOrEco.eco ? simulatedTrain.final_output : simulatedTrain.base;
      const fetchOperationalPoints = async () => {
        setLoading(true);
        const formattedOperationalPoints = await formatOperationalPoints(
          pathProperties.operationalPoints,
          selectedTrainRegime,
          train,
          infraId
        );
        setOperationalPoints(formattedOperationalPoints);
        setLoading(false);
      };
      fetchOperationalPoints();
    }
  }, [train, simulatedTrain, pathProperties, infraId, baseOrEco]);

  return { operationalPoints, loading, baseOrEco, setBaseOrEco };
};
