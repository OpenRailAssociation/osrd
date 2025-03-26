import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import { osrdEditoastApi, type InfraWithState } from 'common/api/osrdEditoastApi';
import usePathProperties from 'modules/pathfinding/hooks/usePathProperties';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import {
  formatPacedTrainIdToEditoastTrainId,
  formatTrainScheduleIdToEditoastTrainId,
  isPacedTrain,
  isTrainSchedule,
} from 'utils/trainId';

const usePathProjection = (infra: InfraWithState) => {
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const editoastTrainId = useMemo(() => {
    if (trainIdUsedForProjection) {
      if (isTrainSchedule(trainIdUsedForProjection)) {
        return formatTrainScheduleIdToEditoastTrainId(trainIdUsedForProjection);
      }
      return formatPacedTrainIdToEditoastTrainId(trainIdUsedForProjection);
    }
    return undefined;
  }, [trainIdUsedForProjection]);

  const { data: trainScheduleProjectionPathResult } =
    osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(
      {
        id: editoastTrainId!,
        infraId: infra.id,
      },
      {
        skip: !trainIdUsedForProjection || !isTrainSchedule(trainIdUsedForProjection),
      }
    );

  const { data: pacedTrainProjectionPathResult } =
    osrdEditoastApi.endpoints.getPacedTrainByIdPath.useQuery(
      {
        id: editoastTrainId!,
        infraId: infra.id,
      },
      {
        skip: !trainIdUsedForProjection || !isPacedTrain(trainIdUsedForProjection),
      }
    );

  const path = useMemo(() => {
    const projectionPathResult =
      trainIdUsedForProjection && isTrainSchedule(trainIdUsedForProjection)
        ? trainScheduleProjectionPathResult
        : pacedTrainProjectionPathResult;
    return projectionPathResult && projectionPathResult?.status === 'success'
      ? projectionPathResult
      : undefined;
  }, [trainScheduleProjectionPathResult, pacedTrainProjectionPathResult]);

  const pathProperties = usePathProperties(infra.id, path, ['geometry']);

  const result = useMemo(
    () =>
      path && pathProperties?.geometry
        ? {
            path,
            geometry: pathProperties.geometry,
          }
        : null,
    [pathProperties]
  );

  return result;
};
export default usePathProjection;
