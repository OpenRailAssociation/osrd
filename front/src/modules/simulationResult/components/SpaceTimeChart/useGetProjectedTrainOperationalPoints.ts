import { useEffect, useMemo, useState } from 'react';

import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { upsertMapWaypointsInOperationalPoints } from 'applications/operationalStudies/helpers/upsertMapWaypointsInOperationalPoints';
import type { OperationalPoint } from 'applications/operationalStudies/types';
import { STDCM_TRAIN_ID } from 'applications/stdcm/consts';
import { osrdEditoastApi, type PathProperties } from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';
import { isStation } from 'modules/pathfinding/utils';
import type { TrainScheduleId, TrainScheduleResultWithTrainId } from 'reducers/osrdconf/types';
import { formatTrainScheduleIdToEditoastTrainId } from 'utils/trainId';

const useGetProjectedTrainOperationalPoints = (
  trainScheduleUsedForProjection?: TrainScheduleResultWithTrainId,
  trainIdUsedForProjection?: TrainScheduleId,
  infraId?: number
) => {
  const { t } = useTranslation('simulation');
  const { getTimetableID } = useOsrdConfSelectors();
  const timetableId = useSelector(getTimetableID);

  const [operationalPoints, setOperationalPoints] = useState<OperationalPoint[]>([]);
  const [filteredOperationalPoints, setFilteredOperationalPoints] =
    useState<OperationalPoint[]>(operationalPoints);

  const editoastTrainIdUsedForProjection = useMemo(
    () =>
      trainIdUsedForProjection
        ? formatTrainScheduleIdToEditoastTrainId(trainIdUsedForProjection)
        : undefined,
    [trainIdUsedForProjection]
  );

  const { data: pathfindingResult } = osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(
    {
      id: editoastTrainIdUsedForProjection!,
      infraId: infraId!,
    },
    {
      skip:
        !editoastTrainIdUsedForProjection ||
        !infraId ||
        editoastTrainIdUsedForProjection === STDCM_TRAIN_ID,
    }
  );

  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useLazyQuery();

  useEffect(() => {
    const getOperationalPoints = async () => {
      if (infraId && trainScheduleUsedForProjection && pathfindingResult?.status === 'success') {
        const { operational_points } = await postPathProperties({
          infraId,
          props: ['operational_points'],
          pathPropertiesInput: {
            track_section_ranges: pathfindingResult.track_section_ranges,
          },
        }).unwrap();

        const operationalPointsWithAllWaypoints = upsertMapWaypointsInOperationalPoints(
          trainScheduleUsedForProjection.path,
          pathfindingResult.path_item_positions,
          operational_points!,
          t
        );
        let operationalPointsWithUniqueIds = operationalPointsWithAllWaypoints.map((op, i) => ({
          ...op,
          id: `${op.id}-${op.position}-${i}`,
        }));

        setOperationalPoints(operationalPointsWithUniqueIds);

        // Check if there are saved manchettes in localStorage for the current timetable and path
        const simplifiedPath = trainScheduleUsedForProjection.path.map((waypoint) =>
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
          operationalPointsWithUniqueIds = operationalPointsWithUniqueIds.filter((op) =>
            op.extensions?.sncf ? isStation(op.extensions.sncf.ch) || op.weight === 100 : true
          );
        }

        setFilteredOperationalPoints(operationalPointsWithUniqueIds);
      }
    };
    getOperationalPoints();
  }, [pathfindingResult, infraId, t]);

  return { operationalPoints, filteredOperationalPoints, setFilteredOperationalPoints };
};

export default useGetProjectedTrainOperationalPoints;
