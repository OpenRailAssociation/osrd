import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import { osrdEditoastApi, type InfraWithState } from 'common/api/osrdEditoastApi';
import usePathProperties from 'modules/pathfinding/hooks/usePathProperties';
import type { TrainScheduleId } from 'reducers/osrdconf/types';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { formatTrainScheduleIdToEditoastTrainId } from 'utils/trainId';

const usePathProjection = (infra: InfraWithState) => {
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  // TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
  const editoastTrainId = trainIdUsedForProjection
    ? formatTrainScheduleIdToEditoastTrainId(trainIdUsedForProjection as TrainScheduleId)
    : undefined;

  const { data: projectionPathResult } =
    osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(
      {
        id: editoastTrainId!,
        infraId: infra.id,
      },
      {
        skip: !trainIdUsedForProjection,
      }
    );

  const path = useMemo(
    () => (projectionPathResult?.status === 'success' ? projectionPathResult : undefined),
    [projectionPathResult]
  );
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
