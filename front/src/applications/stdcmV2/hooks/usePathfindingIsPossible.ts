import { useEffect, useMemo, useState } from 'react';

import { compact } from 'lodash';
import { useSelector } from 'react-redux';

import { osrdEditoastApi, type PathfindingResult } from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';

import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';

import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import useInfraStatus from 'modules/pathfinding/hooks/useInfraStatus';
import { getSupportedElectrification, isThermal } from 'modules/rollingStock/helpers/electric';

const usePathfindingIsPossible = () => {
  const { getStdcmPathSteps } = useOsrdConfSelectors() as StdcmConfSelectors;

  const { infra } = useInfraStatus();
  const pathSteps = useSelector(getStdcmPathSteps);
  const { rollingStock } = useStoreDataForRollingStockSelector();

  const [pathfindingStatus, setPathfindingStatus] = useState<PathfindingResult['status']>();

  const [postPathfindingBlocks] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathfindingBlocks.useMutation();

  const pathStepsLocation = useMemo(() => pathSteps.map((step) => step.location), [pathSteps]);

  useEffect(() => {
    const launchPathfinding = async () => {
      setPathfindingStatus(undefined);
      if (!infra || infra.state !== 'CACHED' || !rollingStock) {
        return;
      }

      const pathItems = compact(pathStepsLocation).map((step) => {
        if ('uic' in step) {
          return { uic: step.uic, secondary_code: step.secondary_code };
        }
        if ('track' in step) {
          return {
            track: step.track,
            // TODO: step offset should be in mm in the store /!\
            // pathfinding blocks endpoint requires offsets in mm
            offset: step.offset * 1000,
          };
        }
        if ('operational_point' in step) {
          return {
            operational_point: step.operational_point,
          };
        }
        return {
          trigram: step.trigram,
          secondary_code: step.secondary_code,
        };
      });

      const payload = {
        infraId: infra.id,
        pathfindingInput: {
          path_items: pathItems,
          rolling_stock_is_thermal: isThermal(rollingStock.effort_curves.modes),
          rolling_stock_loading_gauge: rollingStock.loading_gauge,
          rolling_stock_supported_electrifications: getSupportedElectrification(
            rollingStock.effort_curves.modes
          ),
          rolling_stock_supported_signaling_systems: rollingStock.supported_signaling_systems,
          rolling_stock_maximum_speed: rollingStock.max_speed,
          rolling_stock_length: rollingStock.length,
        },
      };
      const pathfindingResult = await postPathfindingBlocks(payload).unwrap();

      setPathfindingStatus(pathfindingResult.status);
    };

    launchPathfinding();
  }, [pathStepsLocation, rollingStock, infra]);

  return pathfindingStatus;
};

export default usePathfindingIsPossible;
