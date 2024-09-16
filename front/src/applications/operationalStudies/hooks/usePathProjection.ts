import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type InfraWithState,
} from 'common/api/osrdEditoastApi';
import { getTrainIdUsedForProjection } from 'reducers/osrdsimulation/selectors';
import usePathProperties from 'modules/pathfinding/hooks/usePathProperties';

const usePathProjection = (infra: InfraWithState) => {
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const { data: projectionPathResult } =
    osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(
      {
        id: trainIdUsedForProjection!,
        infraId: infra.id,
      },
      {
        skip: !trainIdUsedForProjection,
      }
    );

  const projectionPath = useMemo(
    () => (projectionPathResult?.status === 'success' ? projectionPathResult : undefined),
    [projectionPathResult]
  );
  const projectionPathProperties = usePathProperties(infra.id, projectionPath, ['geometry']);

  return {
    projectionPath,
    projectionPathGeometry: projectionPathProperties?.geometry,
  };
};

export default usePathProjection;
