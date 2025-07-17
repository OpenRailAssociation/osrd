import { useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query/react';
import { useSelector } from 'react-redux';

import { osrdEditoastApi, type InfraWithState } from 'common/api/osrdEditoastApi';
import { getTrainUsedForProjection } from 'reducers/simulationResults/selectors';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  isTrainScheduleId,
  isPacedTrainId,
} from 'utils/trainId';

const usePathProjection = (infra: InfraWithState) => {
  const trainUsedForProjection = useSelector(getTrainUsedForProjection);

  const trainScheduleId =
    trainUsedForProjection && isTrainScheduleId(trainUsedForProjection.id)
      ? extractEditoastIdFromTrainScheduleId(trainUsedForProjection.id)
      : undefined;

  const pacedTrainId =
    trainUsedForProjection && isPacedTrainId(trainUsedForProjection.id)
      ? extractEditoastIdFromPacedTrainId(trainUsedForProjection.id)
      : undefined;

  const scheduleArg = trainScheduleId ? { id: trainScheduleId, infraId: infra.id } : skipToken;
  const pacedArg = pacedTrainId
    ? {
        id: pacedTrainId,
        infraId: infra.id,
        ...('exceptionKey' in trainUsedForProjection! && {
          exceptionKey: trainUsedForProjection.exceptionKey,
        }),
      }
    : skipToken;

  const { data: schedulePath } =
    osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(scheduleArg);
  const { data: pacedPath } = osrdEditoastApi.endpoints.getPacedTrainByIdPath.useQuery(pacedArg);

  const path = trainScheduleId ? schedulePath : pacedPath;

  const { data: pathProperties } =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useQuery(
      path?.status === 'success'
        ? {
            infraId: infra.id,
            props: ['geometry', 'operational_points'],
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
      operationalPoints: pathProperties.operational_points,
    };
  }, [path, pathProperties]);
};

export default usePathProjection;
