import { useEffect, useState } from 'react';

import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';

import { upsertMapWaypointsInOperationalPoints } from 'applications/operationalStudies/helpers/upsertMapWaypointsInOperationalPoints';
import type { OperationalPoint } from 'applications/operationalStudies/types';
import {
  osrdEditoastApi,
  type PathfindingResult,
  type PathProperties,
} from 'common/api/osrdEditoastApi';
import { isStation } from 'modules/pathfinding/utils';
import type { TimetableItemWithTimetableId } from 'reducers/osrdconf/types';
import {
  formatPacedTrainIdToEditoastTrainId,
  formatTrainScheduleIdToEditoastTrainId,
  isTrainScheduleId,
} from 'utils/trainId';

const useGetProjectedTrainOperationalPoints = ({
  infraId,
  timetableId,
  timetableItemUsedForProjection,
}: {
  infraId: number | undefined;
  timetableId: number | undefined;
  timetableItemUsedForProjection?: TimetableItemWithTimetableId;
}) => {
  const { t } = useTranslation('simulation');

  const [operationalPoints, setOperationalPoints] = useState<OperationalPoint[]>([]);
  const [filteredOperationalPoints, setFilteredOperationalPoints] =
    useState<OperationalPoint[]>(operationalPoints);

  const [getTrainSchedulePath] = osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useLazyQuery();
  const [getPacedTrainPath] = osrdEditoastApi.endpoints.getPacedTrainByIdPath.useLazyQuery();
  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useLazyQuery();

  useEffect(() => {
    const getOperationalPoints = async () => {
      if (!timetableItemUsedForProjection || !infraId) return;

      const trainIdUsedForProjection = timetableItemUsedForProjection.id;

      let path: PathfindingResult;
      if (isTrainScheduleId(trainIdUsedForProjection)) {
        path = await getTrainSchedulePath({
          id: formatTrainScheduleIdToEditoastTrainId(trainIdUsedForProjection),
          infraId,
        }).unwrap();
      } else {
        path = await getPacedTrainPath({
          id: formatPacedTrainIdToEditoastTrainId(trainIdUsedForProjection),
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

        const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
          timetableItemUsedForProjection.path,
          path.path_item_positions,
          operational_points!,
          t
        );
        let operationalPointsWithUniqueIds = operationalPointsWithAllWaypoints.map((op, i) => ({
          ...op,
          id: `${op.id}-${op.position}-${i}`,
        }));

        setOperationalPoints(operationalPointsWithUniqueIds);

        // Check if there are saved manchettes in localStorage for the current timetable and path
        const simplifiedPath = timetableItemUsedForProjection.path.map((waypoint) =>
          omit(waypoint, ['id', 'deleted'])
        );
        const stringifiedSavedWaypoints = localStorage.getItem(
          `${timetableId}-${JSON.stringify(simplifiedPath)}`
        );
        if (stringifiedSavedWaypoints) {
          operationalPointsWithUniqueIds = JSON.parse(stringifiedSavedWaypoints) as NonNullable<
            PathProperties['operational_points']
          >;
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
