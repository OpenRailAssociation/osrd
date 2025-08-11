import { useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query/react';
import { useSelector } from 'react-redux';

import { osrdEditoastApi, type InfraWithState } from 'common/api/osrdEditoastApi';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  isTrainScheduleId,
} from 'utils/trainId';

const usePathProjection = (infra: InfraWithState) => {
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const trainScheduleId =
    trainIdUsedForProjection && isTrainScheduleId(trainIdUsedForProjection)
      ? extractEditoastIdFromTrainScheduleId(trainIdUsedForProjection)
      : undefined;

  const pacedTrainId =
    trainIdUsedForProjection && !isTrainScheduleId(trainIdUsedForProjection)
      ? extractEditoastIdFromPacedTrainId(trainIdUsedForProjection)
      : undefined;

  const scheduleArg = trainScheduleId ? { id: trainScheduleId, infraId: infra.id } : skipToken;
  const pacedArg = pacedTrainId ? { id: pacedTrainId, infraId: infra.id } : skipToken;

  const { data: schedulePath } =
    osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(scheduleArg);
  const { data: pacedPath } = osrdEditoastApi.endpoints.getPacedTrainByIdPath.useQuery(pacedArg);

  const path = trainScheduleId ? schedulePath : pacedPath;

  const { data: pathProperties } =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useQuery(
      path?.status === 'success'
        ? {
            infraId: infra.id,
            props: ['geometry'],
            pathPropertiesInput: { track_section_ranges: path.track_section_ranges },
          }
        : skipToken
    );

  return useMemo(() => {
    if (path?.status !== 'success' || !pathProperties) {
      return undefined;
    }
    return {
      path,
      geometry: pathProperties.geometry,
    };
  }, [path, pathProperties]);
};

export default usePathProjection;
