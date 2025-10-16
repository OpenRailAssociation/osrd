import { useCallback, useState } from 'react';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import {
  osrdEditoastApi,
  type PathProperties,
  type PostInfraByInfraIdPathfindingBlocksApiArg,
  type PostInfraByInfraIdPathPropertiesApiArg,
} from 'common/api/osrdEditoastApi';
import { useRollingStockContext } from 'common/RollingStockContext';
import type { PathStepMetadata, PathStepV2 } from 'reducers/osrdconf/types';

const usePathfindingV2 = () => {
  const { infraId } = useScenarioContext();
  const { rollingStocks } = useRollingStockContext();

  const [pathProperties, setPathProperties] = useState<PathProperties>();

  const [postPathfindingBlocks] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathfindingBlocks.useLazyQuery();
  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useLazyQuery();

  const launchPathfindingV2 = useCallback(
    async ({
      pathSteps,
      pathStepsMetadataById,
      rollingStockId,
      speedLimitTag,
    }: {
      pathSteps: PathStepV2['location'][];
      pathStepsMetadataById: Map<string, PathStepMetadata>;
      rollingStockId: number;
      speedLimitTag?: string | null;
    }) => {
      if (
        !pathSteps.every((step) => !!step) ||
        Array.from(pathStepsMetadataById.values()).some((metadata) => metadata.isInvalid)
      ) {
        return;
      }

      const rollingStock = (rollingStocks || []).find((rs) => rs.id === rollingStockId);

      if (!rollingStock) return;

      const rollingStockModes = Object.entries(rollingStock.effort_curves.modes);
      const isThermal = rollingStockModes.some(([, mode]) => !mode.is_electric);
      const supportedElectrirications = rollingStockModes.map(([mode]) => mode);

      const pathFindingPayload: PostInfraByInfraIdPathfindingBlocksApiArg = {
        infraId,
        pathfindingInput: {
          path_items: pathSteps,
          rolling_stock_is_thermal: isThermal,
          rolling_stock_loading_gauge: rollingStock.loading_gauge,
          rolling_stock_supported_electrifications: supportedElectrirications,
          rolling_stock_supported_signaling_systems: rollingStock.supported_signaling_systems,
          rolling_stock_maximum_speed: rollingStock.max_speed,
          rolling_stock_length: rollingStock.length,
          speed_limit_tag: speedLimitTag,
        },
      };

      const pathfindingResult = await postPathfindingBlocks(pathFindingPayload).unwrap();

      if (pathfindingResult.status === 'success') {
        const pathPropertiesParams: PostInfraByInfraIdPathPropertiesApiArg = {
          infraId,
          pathPropertiesInput: {
            track_section_ranges: pathfindingResult.path.track_section_ranges,
          },
        };
        const pathPropertiesResult = await postPathProperties(pathPropertiesParams).unwrap();

        setPathProperties(pathPropertiesResult);
      }
    },
    [infraId]
  );

  return { launchPathfindingV2, pathProperties };
};

export default usePathfindingV2;
