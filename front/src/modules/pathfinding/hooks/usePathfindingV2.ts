import { useCallback, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { ItineraryPathProperties } from 'applications/operationalStudies/types';
import {
  osrdEditoastApi,
  type PostInfraByInfraIdPathfindingBlocksApiArg,
  type PostInfraByInfraIdPathPropertiesApiArg,
} from 'common/api/osrdEditoastApi';
import { useRollingStockContext } from 'common/RollingStockContext';
import type { PathStepMetadata, PathStepV2 } from 'reducers/osrdconf/types';
import { mToMm } from 'utils/physics';

const usePathfindingV2 = () => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });

  const { infraId } = useScenarioContext();
  const { rollingStocks } = useRollingStockContext();

  const [pathProperties, setPathProperties] = useState<ItineraryPathProperties>();
  const [pathfindingError, setPathfindingError] = useState('');

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
      setPathfindingError('');

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
          path_items: pathSteps.map((location) => ({ location, can_backtrack: false })),
          rolling_stock_is_thermal: isThermal,
          rolling_stock_loading_gauge: rollingStock.loading_gauge,
          rolling_stock_supported_electrifications: supportedElectrirications,
          rolling_stock_supported_signaling_systems: rollingStock.supported_signaling_systems.map(
            (s) => s.type
          ),
          rolling_stock_maximum_speed: rollingStock.max_speed,
          rolling_stock_length: Math.round(mToMm(rollingStock.length)),
          speed_limit_tag: speedLimitTag,
        },
      };

      setPathProperties(undefined);
      setPathfindingError('');

      const pathfindingResult = await postPathfindingBlocks(pathFindingPayload).unwrap();

      if (pathfindingResult.status === 'success') {
        const pathPropertiesParams: PostInfraByInfraIdPathPropertiesApiArg = {
          infraId,
          pathPropertiesInput: {
            track_section_ranges: pathfindingResult.path.track_section_ranges,
          },
        };
        const pathPropertiesResult = await postPathProperties(pathPropertiesParams).unwrap();

        setPathProperties({
          ...pathPropertiesResult,
          length: pathfindingResult.length,
          pathItemPositions: pathfindingResult.path_item_positions,
        });
        return;
      }

      const incompatibleConstraintsCheck =
        pathfindingResult.failed_status === 'pathfinding_not_found' &&
        pathfindingResult.error_type === 'incompatible_constraints';

      if (incompatibleConstraintsCheck) {
        const pathPropertiesParams: PostInfraByInfraIdPathPropertiesApiArg = {
          infraId,
          pathPropertiesInput: {
            track_section_ranges:
              pathfindingResult.relaxed_constraints_path.path.track_section_ranges,
          },
        };
        const pathPropertiesResult = await postPathProperties(pathPropertiesParams).unwrap();

        setPathProperties({
          ...pathPropertiesResult,
          length: pathfindingResult.relaxed_constraints_path.length,
          incompatibleConstraints: pathfindingResult.incompatible_constraints,
          pathItemPositions: pathfindingResult.relaxed_constraints_path.path_item_positions,
        });
        setPathfindingError(t(`pathfindingErrors.${pathfindingResult.error_type}`));
        return;
      }

      const hasInvalidPathItems =
        pathfindingResult.failed_status === 'pathfinding_input_error' &&
        pathfindingResult.error_type === 'invalid_path_items';

      if (hasInvalidPathItems) {
        setPathfindingError(t('missingPathSteps'));
        setPathProperties(undefined);
        return;
      }

      setPathfindingError(t(`pathfindingErrors.${pathfindingResult.error_type}`));
      setPathProperties(undefined);
    },
    [infraId]
  );

  return { launchPathfindingV2, pathProperties, pathfindingError };
};

export default usePathfindingV2;
