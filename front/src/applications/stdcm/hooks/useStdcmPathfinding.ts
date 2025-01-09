import { useEffect, useMemo, useState } from 'react';

import { compact, isEqual } from 'lodash';
import { useSelector } from 'react-redux';

import { osrdEditoastApi, type InfraWithState } from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';
import usePathProperties from 'modules/pathfinding/hooks/usePathProperties';
import { getPathfindingQuery } from 'modules/pathfinding/utils';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import type { StdcmPathStep } from 'reducers/osrdconf/types';

/**
 * Compute the path items locations from the path steps
 */
function pathStepsToLocations(
  pathSteps: StdcmPathStep[]
): Array<NonNullable<StdcmPathStep['location']>> {
  return compact(pathSteps.map((s) => s.location));
}

const useStdcmPathfinding = (infra?: InfraWithState) => {
  const { getStdcmPathSteps } = useOsrdConfSelectors() as StdcmConfSelectors;
  const pathSteps = useSelector(getStdcmPathSteps);
  const [pathStepsLocations, setPathStepsLocations] = useState(pathStepsToLocations(pathSteps));
  const { rollingStock } = useStoreDataForRollingStockSelector();

  // When pathSteps changed
  // => update the pathStepsLocations (if needed by doing a deep comparison).
  useEffect(() => {
    setPathStepsLocations((prev) => {
      const newSteps = pathStepsToLocations(pathSteps);
      if (isEqual(prev, newSteps)) return prev;
      return newSteps;
    });
  }, [pathSteps]);

  const pathfindingPayload = useMemo(() => {
    if (infra?.state !== 'CACHED' || pathStepsLocations.length < 2) {
      return null;
    }
    return getPathfindingQuery({
      infraId: infra.id,
      rollingStock,
      pathSteps: pathStepsLocations,
    });
  }, [pathStepsLocations, rollingStock, infra]);

  const { data: pathfinding, isFetching } =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathfindingBlocks.useQuery(pathfindingPayload!, {
      skip: !pathfindingPayload,
    });

  const pathProperties = usePathProperties(
    infra?.id,
    pathfinding?.status === 'success' ? pathfinding : undefined,
    ['geometry']
  );

  const pathfindingResult = useMemo(
    () =>
      pathfinding
        ? {
            status: pathfinding.status,
            geometry: pathProperties?.geometry ?? undefined,
          }
        : null,
    [pathfinding, pathProperties]
  );

  return { isPathFindingLoading: isFetching, pathfinding: pathfindingResult };
};

export default useStdcmPathfinding;
