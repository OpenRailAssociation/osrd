import { useEffect, useState } from 'react';

import type {
  LayerData,
  PowerRestrictionValues,
} from '@osrd-project/ui-speedspacechart/dist/types/chartTypes';
import { useTranslation } from 'react-i18next';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import { preparePathPropertiesData } from 'applications/operationalStudies/utils';
import {
  osrdEditoastApi,
  type PathfindingResultSuccess,
  type SimulationResponse,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import usePathProperties from 'modules/pathfinding/hooks/usePathProperties';
import formatPowerRestrictionRangesWithHandled from 'modules/powerRestriction/helpers/formatPowerRestrictionRangesWithHandled';
import type { SpeedSpaceChartData } from 'modules/simulationResult/types';

import { updateChartSynchronizerTrainData } from '../ChartSynchronizer/utils';

/** Prepare data needed for speedSpaceChart */
const useSpeedSpaceChart = (
  trainScheduleResult?: TrainScheduleResult,
  pathfindingResult?: PathfindingResultSuccess,
  simulation?: SimulationResponse,
  departureTime?: string
): SpeedSpaceChartData | null => {
  const { t } = useTranslation('simulation');
  const infraId = useInfraID();

  const [formattedPathProperties, setFormattedPathProperties] = useState<PathPropertiesFormatted>();
  const [formattedPowerRestrictions, setFormattedPowerRestrictions] =
    useState<LayerData<PowerRestrictionValues>[]>();

  const rollingStockName = trainScheduleResult?.rolling_stock_name;
  const { data: rollingStock } =
    osrdEditoastApi.endpoints.getRollingStockNameByRollingStockName.useQuery(
      {
        rollingStockName: rollingStockName!,
      },
      { skip: !rollingStockName }
    );

  const pathProperties = usePathProperties(infraId, pathfindingResult, [
    'electrifications',
    'geometry',
    'operational_points',
    'curves',
    'slopes',
  ]);

  // retrieve and format pathfinding properties
  useEffect(() => {
    const getPathProperties = async () => {
      if (
        infraId &&
        trainScheduleResult &&
        rollingStock &&
        pathfindingResult &&
        simulation?.status === 'success' &&
        pathProperties
      ) {
        const formattedPathProps = preparePathPropertiesData(
          simulation.electrical_profiles,
          pathProperties,
          pathfindingResult,
          trainScheduleResult.path,
          t
        );

        setFormattedPathProperties(formattedPathProps);

        // Format power restrictions
        const powerRestrictions = formatPowerRestrictionRangesWithHandled({
          selectedTrainSchedule: trainScheduleResult,
          selectedTrainRollingStock: rollingStock,
          pathfindingResult,
          pathProperties: formattedPathProps,
        });
        setFormattedPowerRestrictions(powerRestrictions);
      }
    };

    getPathProperties();
  }, [pathProperties, infraId, rollingStock]);

  // setup chart synchronizer
  useEffect(() => {
    if (simulation?.status === 'success' && trainScheduleResult && rollingStock && departureTime) {
      updateChartSynchronizerTrainData(simulation, rollingStock, departureTime);
    }
  }, [simulation, trainScheduleResult, rollingStock, departureTime]);

  return trainScheduleResult &&
    rollingStock &&
    simulation?.status === 'success' &&
    formattedPathProperties &&
    departureTime
    ? {
        rollingStock,
        formattedPowerRestrictions,
        simulation,
        formattedPathProperties,
        departureTime,
      }
    : null;
};

export default useSpeedSpaceChart;
