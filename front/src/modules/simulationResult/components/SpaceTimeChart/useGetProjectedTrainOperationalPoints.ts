import { useEffect, useState } from 'react';

import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';

import { upsertMapWaypointsInOperationalPoints } from 'applications/operationalStudies/helpers/upsertMapWaypointsInOperationalPoints';
import { osrdEditoastApi, type PathfindingResult } from 'common/api/osrdEditoastApi';
import { isStation } from 'modules/pathfinding/utils';
import type { PathOperationalPoint } from 'modules/simulationResult/types';
import type { TimetableItem } from 'reducers/osrdconf/types';
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
}: {
  infraId: number;
  timetableId: number | undefined;
  timetableItemUsedForProjection?: TimetableItem;
}) => {
  const { t } = useTranslation('operational-studies');

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
        path = await getPacedTrainPath({
          id: extractEditoastIdFromPacedTrainId(trainIdUsedForProjection),
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

        operationalPointsWithUniqueIds = upsertMapWaypointsInOperationalPoints(
          'PathOperationalPoint',
          timetableItemUsedForProjection.path,
          path.path_item_positions,
          operationalPointsWithUniqueIds,
          t
        );

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
  }, [timetableItemUsedForProjection, infraId, t]);

  return { operationalPoints, filteredOperationalPoints, setFilteredOperationalPoints };
};

export default useGetProjectedTrainOperationalPoints;
