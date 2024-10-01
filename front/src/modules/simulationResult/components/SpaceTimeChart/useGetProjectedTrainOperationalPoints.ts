import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { upsertMapWaypointsInOperationalPoints } from 'applications/operationalStudies/helpers/upsertMapWaypointsInOperationalPoints';
import { STDCM_TRAIN_ID } from 'applications/stdcm/consts';
import {
  osrdEditoastApi,
  type PathProperties,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';

const useGetProjectedTrainOperationalPoints = (
  trainScheduleUsedForProjection?: TrainScheduleResult,
  trainIdUsedForProjection?: number,
  infraId?: number
) => {
  const { t } = useTranslation('simulation');
  const [operationalPoints, setOperationalPoints] = useState<
    NonNullable<PathProperties['operational_points']>
  >([]);

  const { data: pathfindingResult } = osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(
    {
      id: trainIdUsedForProjection!,
      infraId: infraId!,
    },
    {
      skip: !trainIdUsedForProjection || !infraId || trainIdUsedForProjection === STDCM_TRAIN_ID,
    }
  );

  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useMutation();

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
        const operationalPointsWithUniqueIds = operationalPointsWithAllWaypoints.map((op, i) => ({
          ...op,
          id: `${op.id}-${op.position}-${i}`,
        }));

        setOperationalPoints(operationalPointsWithUniqueIds);
      }
    };
    getOperationalPoints();
  }, [pathfindingResult, infraId, t]);

  return operationalPoints;
};

export default useGetProjectedTrainOperationalPoints;
