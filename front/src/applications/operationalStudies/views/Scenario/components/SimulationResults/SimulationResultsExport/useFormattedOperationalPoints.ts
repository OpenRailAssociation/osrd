import { useEffect, useState } from 'react';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type {
  OperationalPointWithTimeAndSpeed,
  PathPropertiesFormatted,
} from 'applications/operationalStudies/types';
import type { SimulationResponseSuccess } from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';

import { formatOperationalPoints } from './utils';

/**
 * add time, speed, position, duration to operational points
 */
const useFormattedOperationalPoints = (
  trainSchedule?: Train,
  simulatedTrainSchedule?: SimulationResponseSuccess,
  pathProperties?: PathPropertiesFormatted
) => {
  const [operationalPoints, setOperationalPoints] = useState<OperationalPointWithTimeAndSpeed[]>(
    []
  );
  const { getTrackSectionsByIds } = useScenarioContext();

  useEffect(() => {
    if (trainSchedule && simulatedTrainSchedule && pathProperties) {
      const fetchOperationalPoints = async () => {
        const trackIds = pathProperties.operationalPoints.map((op) => op.part.track);
        const trackSections = await getTrackSectionsByIds(trackIds);
        const formattedOperationalPoints = formatOperationalPoints(
          pathProperties.operationalPoints,
          simulatedTrainSchedule,
          trainSchedule,
          trackSections
        );
        setOperationalPoints(formattedOperationalPoints);
      };
      fetchOperationalPoints();
    }
  }, [trainSchedule, simulatedTrainSchedule, pathProperties, getTrackSectionsByIds]);

  return operationalPoints;
};

export default useFormattedOperationalPoints;
