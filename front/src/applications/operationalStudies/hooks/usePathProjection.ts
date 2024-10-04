import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import { osrdEditoastApi, type InfraWithState } from 'common/api/osrdEditoastApi';
import usePathProperties from 'modules/pathfinding/hooks/usePathProperties';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';

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
