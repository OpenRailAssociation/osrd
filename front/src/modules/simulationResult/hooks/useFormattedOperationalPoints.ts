/* eslint-disable import/prefer-default-export */
import { useEffect, useState } from 'react';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type {
  OperationalPointWithTimeAndSpeed,
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';

import { formatOperationalPoints } from '../components/SimulationResultExport/utils';

/**
 * add time, speed, position, duration to operational points
 */
export const useFormattedOperationalPoints = (
  train?: TrainScheduleBase,
  simulatedTrain?: SimulationResponseSuccess,
  pathProperties?: PathPropertiesFormatted
) => {
  const [operationalPoints, setOperationalPoints] = useState<OperationalPointWithTimeAndSpeed[]>();
  const [loading, setLoading] = useState(false);
  const { getTrackSectionsByIds } = useScenarioContext();

  useEffect(() => {
    if (train && simulatedTrain && pathProperties) {
      const fetchOperationalPoints = async () => {
        setLoading(true);

        const trackIds = pathProperties.operationalPoints.map((op) => op.part.track);
        const trackSections = await getTrackSectionsByIds(trackIds);
        const formattedOperationalPoints = formatOperationalPoints(
          pathProperties.operationalPoints,
          simulatedTrain,
          train,
          trackSections
        );
        setOperationalPoints(formattedOperationalPoints);
        setLoading(false);
      };
      fetchOperationalPoints();
    }
  }, [train, simulatedTrain, pathProperties, getTrackSectionsByIds]);

  return { operationalPoints, loading };
};
