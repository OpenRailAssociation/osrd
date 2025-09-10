import { useEffect, useState } from 'react';

import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { upsertMapWaypointsInOperationalPoints } from 'applications/operationalStudies/helpers/upsertMapWaypointsInOperationalPoints';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import useScenarioData from 'applications/operationalStudies/hooks/useScenarioData';
import {
  type OperationalPointReference,
  type PathfindingResultSuccess,
} from 'common/api/osrdEditoastApi';
import { isStation } from 'modules/pathfinding/utils';
import type { ProjectedOperationalPoint } from 'modules/simulationResult/types';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { getProjectionType } from 'reducers/simulationResults/selectors';

import { getWaypointsLocalStorageKey } from './helpers/utils';

const useGetProjectedTrainOperationalPoints = ({
  infraId,
  timetableId,
  path,
  pathfinding,
}: {
  infraId: number;
  timetableId: number | undefined;
  path?: TimetableItem['path'];
  pathfinding?: PathfindingResultSuccess;
}) => {
  const { t } = useTranslation('operational-studies');
  const projectionType = useSelector(getProjectionType);
  const { infra, scenario } = useScenarioContext();
  const { projectionData } = useScenarioData(scenario, infra);
  const operational_points = projectionData?.operationalPoints;

  const [operationalPoints, setOperationalPoints] = useState<ProjectedOperationalPoint[]>([]);
  const [filteredOperationalPoints, setFilteredOperationalPoints] = useState<
    ProjectedOperationalPoint[]
  >([]);

  useEffect(() => {
    // 2. Construire un nouvel type à partir d'opRef et l'utiliser pour operationalPoints
    // gérer aussi le cas où on n'a pas de pathfinding
    const getOperationalPoints = async () => {
      if (!path || !pathfinding) return;

      let operationalPointsWithUniqueIds: ProjectedOperationalPoint[] =
        operational_points?.map((op, i) => {
          const ref: OperationalPointReference = { operational_point: op.id };
          return {
            ...omit(op, 'id'),
            waypointId: `${op.id}-${op.position}-${i}`,
            opId: op.id,
            ref,
          };
        }) || [];

      operationalPointsWithUniqueIds =
        projectionType === 'trackProjection'
          ? upsertMapWaypointsInOperationalPoints(
              'PathOperationalPoint',
              path,
              pathfinding.path_item_positions,
              operationalPointsWithUniqueIds,
              t
            )
          : operationalPointsWithUniqueIds;

      setOperationalPoints(operationalPointsWithUniqueIds);

      const stringifiedSavedWaypoints = localStorage.getItem(
        getWaypointsLocalStorageKey(timetableId, path)
      );
      if (stringifiedSavedWaypoints) {
        operationalPointsWithUniqueIds = JSON.parse(
          stringifiedSavedWaypoints
        ) as ProjectedOperationalPoint[];
      } else {
        // If the manchette hasn't been saved, we want to display by default only
        // the waypoints with CH BV/00/'' and the path steps (origin, destination, vias)

        const lastIndex = operationalPointsWithUniqueIds.length - 1;
        operationalPointsWithUniqueIds = operationalPointsWithUniqueIds.filter((op, i) => {
          if (i === 0 || i === lastIndex) return true;
          // handle waypoints added from the map
          if (!op.extensions?.sncf) return true;
          // handle waypoints added from the pathfinding or operational points on path
          return isStation(op.extensions.sncf.ch) || op.weight === 100;
        });
      }

      setFilteredOperationalPoints(operationalPointsWithUniqueIds);
    };

    getOperationalPoints();
  }, [path, pathfinding, infraId, t, projectionType]);

  return { operationalPoints, filteredOperationalPoints, setFilteredOperationalPoints };
};

export default useGetProjectedTrainOperationalPoints;
