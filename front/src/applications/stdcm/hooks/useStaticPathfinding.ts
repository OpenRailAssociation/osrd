import { useEffect, useMemo, useState } from 'react';

import { compact, isEqual } from 'lodash';
import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type InfraWithState,
  type PathfindingResult,
} from 'common/api/osrdEditoastApi';
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

const useStaticPathfinding = (infra?: InfraWithState) => {
  const { getStdcmPathSteps } = useOsrdConfSelectors() as StdcmConfSelectors;
  const pathSteps = useSelector(getStdcmPathSteps);
  const [pathStepsLocations, setPathStepsLocations] = useState(pathStepsToLocations(pathSteps));
  const { rollingStock } = useStoreDataForRollingStockSelector();

  const [pathfinding, setPathfinding] = useState<PathfindingResult>();

  const [postPathfindingBlocks, { isFetching }] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathfindingBlocks.useLazyQuery();

  // When pathSteps changed
  // => update the pathStepsLocations (if needed by doing a deep comparison).
  useEffect(() => {
    setPathStepsLocations((prev) => {
      const newSteps = pathStepsToLocations(pathSteps);
      if (isEqual(prev, newSteps)) return prev;
      return newSteps;
    });
  }, [pathSteps]);

  const pathProperties = usePathProperties(
    infra?.id,
    pathfinding?.status === 'success' ? pathfinding : undefined,
    ['geometry']
  );

  useEffect(() => {
    const launchPathfinding = async () => {
      setPathfinding(undefined);
      if (infra?.state !== 'CACHED' || !rollingStock || pathStepsLocations.length < 2) {
        return;
      }

      // Don't run the pathfinding if the origin and destination are the same:
      const origin = pathSteps.at(0)!;
      const destination = pathSteps.at(-1)!;
      if (
        origin.location!.uic === destination.location!.uic &&
        origin.location!.secondary_code === destination.location!.secondary_code
      ) {
        return;
      }

      const payload = getPathfindingQuery({
        infraId: infra.id,
        rollingStock,
        pathSteps: pathStepsLocations,
      });

      if (payload === null) {
        return;
      }

      const pathfindingResult = await postPathfindingBlocks(payload).unwrap();

      setPathfinding(pathfindingResult);
    };

    launchPathfinding();
  }, [pathStepsLocations, rollingStock, infra]);

  const result = useMemo(
    () =>
      pathfinding
        ? { status: pathfinding.status, geometry: pathProperties?.geometry ?? undefined }
        : null,
    [pathfinding, pathProperties]
  );

  return { pathfinding: result, isPathFindingLoading: isFetching };
};

export default useStaticPathfinding;
