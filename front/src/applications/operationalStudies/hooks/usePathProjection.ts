import { useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query/react';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { InfraWithStatus } from 'modules/infra/types';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  isPacedTrainId,
  isTrainScheduleId,
} from 'utils/trainId';

const usePathProjection = (infra: InfraWithStatus) => {
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const trainScheduleId =
    trainIdUsedForProjection && isTrainScheduleId(trainIdUsedForProjection)
      ? extractEditoastIdFromTrainScheduleId(trainIdUsedForProjection)
      : undefined;

  const pacedTrainId =
    trainIdUsedForProjection && isPacedTrainId(trainIdUsedForProjection)
      ? extractEditoastIdFromPacedTrainId(trainIdUsedForProjection)
      : undefined;

  const scheduleArg = trainScheduleId ? { id: trainScheduleId, infraId: infra.id } : skipToken;
  const pacedArg = pacedTrainId ? { id: pacedTrainId, infraId: infra.id } : skipToken;

  const { data: schedulePath } =
    osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(scheduleArg);
  const { data: pacedPath } = osrdEditoastApi.endpoints.getPacedTrainByIdPath.useQuery(pacedArg);

  const pathfinding = trainScheduleId ? schedulePath : pacedPath;

  const { data: pathProperties } =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useQuery(
      pathfinding?.status === 'success'
        ? {
            infraId: infra.id,
            props: ['geometry', 'operational_points'],
            pathPropertiesInput: { track_section_ranges: pathfinding.track_section_ranges },
          }
        : skipToken
    );

  return useMemo(() => {
    if (pathfinding?.status !== 'success' || !pathProperties) {
      return undefined;
    }
    return {
      pathfinding,
      geometry: pathProperties.geometry,
      operationalPoints: pathProperties.operational_points,
    };
  }, [pathfinding, pathProperties]);
};

export default usePathProjection;
