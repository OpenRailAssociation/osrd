import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { upsertMapWaypointsInOperationalPoints } from 'applications/operationalStudies/helpers/upsertMapWaypointsInOperationalPoints';
import type {
  CorePathfindingResultSuccess,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import type { ProjectionWaypoint, ProjectionData } from 'modules/simulationResult/types';
import { getProjectionType } from 'reducers/simulationResults/selectors';

import { getWaypointsLocalStorageKey } from './helpers/utils';
const useGetProjectedTrainOperationalPoints = ({
  infraId,
  timetableId,
  path,
  pathfinding,
  projectedOperationalPoints,
}: {
  infraId: number;
  timetableId: number | undefined;
  path?: TrainScheduleResponse['path'];
  pathfinding?: CorePathfindingResultSuccess;
  projectedOperationalPoints?: ProjectionData['operationalPoints'];
}) => {
  const { t } = useTranslation('operational-studies');
  const projectionType = useSelector(getProjectionType);

  const [operationalPoints, setOperationalPoints] = useState<ProjectionWaypoint[]>([]);
  const [filteredOperationalPoints, setFilteredOperationalPoints] =
    useState<ProjectionWaypoint[]>(operationalPoints);

  useEffect(() => {
    const getOperationalPoints = async () => {
      let operationalPointsWithUniqueIds =
        projectionType === 'trackProjection' && path && pathfinding
          ? upsertMapWaypointsInOperationalPoints(
              'projection',
              path,
              pathfinding.path_item_positions,
              projectedOperationalPoints || [],
              t
            )
          : projectedOperationalPoints || [];

      setOperationalPoints(operationalPointsWithUniqueIds);

      const stringifiedSavedWaypoints = localStorage.getItem(
        getWaypointsLocalStorageKey(timetableId, path)
      );

      if (stringifiedSavedWaypoints) {
        operationalPointsWithUniqueIds = JSON.parse(
          stringifiedSavedWaypoints
        ) as ProjectionWaypoint[];
      } else {
        // If the manchette hasn't been saved, we want to display by default only
        // the waypoints with CH BV/00/'' and the path steps (origin, destination, vias)

        const lastIndex = operationalPointsWithUniqueIds.length - 1;
        operationalPointsWithUniqueIds = operationalPointsWithUniqueIds.filter((op, i) => {
          if (i === 0 || i === lastIndex) return true;
          // handle waypoints added from the map
          if (!op.opId) return true;
          // handle waypoints added from the pathfinding or operational points on path
          return op.is_passenger_station || op.weight === 100;
        });
      }

      setFilteredOperationalPoints(operationalPointsWithUniqueIds);
    };

    getOperationalPoints();
  }, [path, pathfinding, infraId, projectedOperationalPoints, timetableId, t, projectionType]);

  return { operationalPoints, filteredOperationalPoints, setFilteredOperationalPoints };
};

export default useGetProjectedTrainOperationalPoints;
