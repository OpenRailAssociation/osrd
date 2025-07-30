import { useEffect, useState } from 'react';

import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { upsertMapWaypointsInOperationalPoints } from 'applications/operationalStudies/helpers/upsertMapWaypointsInOperationalPoints';
import { osrdEditoastApi, type PathfindingResult } from 'common/api/osrdEditoastApi';
import { isStation } from 'modules/pathfinding/utils';
import type { PathOperationalPoint } from 'modules/simulationResult/types';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { getProjectionType } from 'reducers/simulationResults/selectors';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  isTrainScheduleId,
} from 'utils/trainId';

import { getWaypointsLocalStorageKey } from './helpers/utils';

const useGetProjectedTrainOperationalPoints = ({
  infraId,
  timetableId,
  timetableItemUsedForProjection,
  exceptionKeyUsedForProjection,
}: {
  infraId: number;
  timetableId: number | undefined;
  timetableItemUsedForProjection?: TimetableItem;
  exceptionKeyUsedForProjection?: string;
}) => {
  const { t } = useTranslation('operational-studies');
  const projectionType = useSelector(getProjectionType);

  const [operationalPoints, setOperationalPoints] = useState<PathOperationalPoint[]>([]);
  const [filteredOperationalPoints, setFilteredOperationalPoints] =
    useState<PathOperationalPoint[]>(operationalPoints);

  const [getTrainSchedulePath] = osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useLazyQuery();
  const [getPacedTrainPath] = osrdEditoastApi.endpoints.getPacedTrainByIdPath.useLazyQuery();
  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useLazyQuery();

  useEffect(() => {
    const getOperationalPoints = async () => {
      if (!timetableItemUsedForProjection) return;

      const trainIdUsedForProjection = timetableItemUsedForProjection.id;

      let path: PathfindingResult;
      if (isTrainScheduleId(trainIdUsedForProjection)) {
        path = await getTrainSchedulePath({
          id: extractEditoastIdFromTrainScheduleId(trainIdUsedForProjection),
          infraId,
        }).unwrap();
      } else {
        // paced train
        path = await getPacedTrainPath({
          id: extractEditoastIdFromPacedTrainId(trainIdUsedForProjection),
          exceptionKey: exceptionKeyUsedForProjection,
          infraId,
        }).unwrap();
      }

      if (path.status !== 'success') return;

      if (timetableItemUsedForProjection) {
        const { operational_points } = await postPathProperties({
          infraId,
          props: ['operational_points'],
          pathPropertiesInput: {
            track_section_ranges: path.track_section_ranges,
          },
        }).unwrap();

        let operationalPointsWithUniqueIds: PathOperationalPoint[] =
          operational_points?.map((op, i) => ({
            ...omit(op, 'id'),
            waypointId: `${op.id}-${op.position}-${i}`,
            opId: op.id,
          })) || [];

        operationalPointsWithUniqueIds =
          projectionType === 'trackProjection'
            ? upsertMapWaypointsInOperationalPoints(
                'PathOperationalPoint',
                timetableItemUsedForProjection.path,
                path.path_item_positions,
                operationalPointsWithUniqueIds,
                t
              )
            : operationalPointsWithUniqueIds;

        setOperationalPoints(operationalPointsWithUniqueIds);

        const stringifiedSavedWaypoints = localStorage.getItem(
          getWaypointsLocalStorageKey(timetableId, timetableItemUsedForProjection.path)
        );
        if (stringifiedSavedWaypoints) {
          operationalPointsWithUniqueIds = JSON.parse(
            stringifiedSavedWaypoints
          ) as PathOperationalPoint[];
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
      }
    };

    getOperationalPoints();
  }, [timetableItemUsedForProjection, exceptionKeyUsedForProjection, infraId, t, projectionType]);

  return { operationalPoints, filteredOperationalPoints, setFilteredOperationalPoints };
};

export default useGetProjectedTrainOperationalPoints;
