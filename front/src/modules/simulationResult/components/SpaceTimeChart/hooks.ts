import { useEffect, useState } from 'react';

import { STDCM_TRAIN_ID } from 'applications/stdcm/consts';
import {
  osrdEditoastApi,
  type PathProperties,
  type PostV2InfraByInfraIdPathPropertiesApiArg,
} from 'common/api/osrdEditoastApi';

const useGetProjectedTrainOperationalPoints = (
  trainIdUsedForProjection?: number,
  infraId?: number
) => {
  const [operationalPoints, setOperationalPoints] = useState<
    NonNullable<PathProperties['operational_points']>
  >([]);

  const { data: pathfindingResult } = osrdEditoastApi.endpoints.getV2TrainScheduleByIdPath.useQuery(
    {
      id: trainIdUsedForProjection as number,
      infraId: infraId as number,
    },
    {
      skip: !trainIdUsedForProjection || !infraId || trainIdUsedForProjection === STDCM_TRAIN_ID,
    }
  );

  const [postPathProperties] =
    osrdEditoastApi.endpoints.postV2InfraByInfraIdPathProperties.useMutation();

  useEffect(() => {
    const getOperationalPoints = async () => {
      if (infraId && pathfindingResult && pathfindingResult.status === 'success') {
        const pathPropertiesParams: PostV2InfraByInfraIdPathPropertiesApiArg = {
          infraId,
          props: ['operational_points'],
          pathPropertiesInput: {
            track_section_ranges: pathfindingResult.track_section_ranges,
          },
        };
        const { operational_points } = await postPathProperties(pathPropertiesParams).unwrap();

        setOperationalPoints(
          operational_points as NonNullable<PathProperties['operational_points']>
        );
      }
    };
    getOperationalPoints();
  }, [pathfindingResult, infraId]);

  return operationalPoints;
};

export default useGetProjectedTrainOperationalPoints;
