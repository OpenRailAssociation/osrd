import { useEffect, useMemo, useState } from 'react';

import { compact } from 'lodash';
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

const useStaticPathfinding = (infra?: InfraWithState) => {
  const { getStdcmPathSteps } = useOsrdConfSelectors() as StdcmConfSelectors;

  const pathSteps = useSelector(getStdcmPathSteps);
  const { rollingStock } = useStoreDataForRollingStockSelector();

  const [pathfinding, setPathfinding] = useState<PathfindingResult>();

  const [postPathfindingBlocks] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathfindingBlocks.useMutation();

  const pathStepsLocations = useMemo(
    () =>
      compact(
        pathSteps.map((step) => (step && (!('uic' in step) || step.uic !== -1) ? step : null))
      ),
    [pathSteps]
  );

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

      const payload = getPathfindingQuery({
        infraId: infra.id,
        rollingStock,
        origin: pathStepsLocations.at(0) || null,
        destination: pathStepsLocations.at(-1) || null,
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

  return result;
};

export default useStaticPathfinding;
