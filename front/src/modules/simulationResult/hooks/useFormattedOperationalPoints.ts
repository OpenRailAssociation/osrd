/* eslint-disable import/prefer-default-export */
import { useEffect, useState } from 'react';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type {
  OperationalPointWithTimeAndSpeed,
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { TimetableItemWithTimetableId } from 'reducers/osrdconf/types';

import { formatOperationalPoints } from '../SimulationResultExport/utils';

/**
 * add time, speed, position, duration to operational points
 */
export const useFormattedOperationalPoints = (
  timetableItem?: TimetableItemWithTimetableId,
  simulatedTimetableItem?: SimulationResponseSuccess,
  pathProperties?: PathPropertiesFormatted
) => {
  const [operationalPoints, setOperationalPoints] = useState<OperationalPointWithTimeAndSpeed[]>();
  const [loading, setLoading] = useState(false);
  const { getTrackSectionsByIds } = useScenarioContext();

  useEffect(() => {
    if (timetableItem && simulatedTimetableItem && pathProperties) {
      const fetchOperationalPoints = async () => {
        setLoading(true);

        const trackIds = pathProperties.operationalPoints.map((op) => op.part.track);
        const trackSections = await getTrackSectionsByIds(trackIds);
        const formattedOperationalPoints = formatOperationalPoints(
          pathProperties.operationalPoints,
          simulatedTimetableItem,
          timetableItem,
          trackSections
        );
        setOperationalPoints(formattedOperationalPoints);
        setLoading(false);
      };
      fetchOperationalPoints();
    }
  }, [timetableItem, simulatedTimetableItem, pathProperties, getTrackSectionsByIds]);

  return { operationalPoints, loading };
};
