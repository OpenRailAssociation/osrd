import { useEffect, useState } from 'react';

import type {
  LayerData,
  PowerRestrictionValues,
} from '@osrd-project/ui-speedspacechart/dist/types/chartTypes';

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

import { updateChartSynchronizerV2TrainData } from '../ChartSynchronizer/utils';

/** Prepare data needed for speedSpaceChart */
const useSpeedSpaceChart = (
  trainScheduleResult?: TrainScheduleResult,
  pathfindingResult?: PathfindingResultSuccess,
  simulation?: SimulationResponse,
  departureTime?: string
) => {
  const infraId = useInfraID();

  const [formattedPathProperties, setFormattedPathProperties] = useState<PathPropertiesFormatted>();
  const [formattedPowerRestrictions, setFormattedPowerRestrictions] =
    useState<LayerData<PowerRestrictionValues>[]>();

  const { data: rollingStock } =
    osrdEditoastApi.endpoints.getRollingStockNameByRollingStockName.useQuery(
      {
        rollingStockName: trainScheduleResult?.rolling_stock_name as string,
      },
      { skip: !trainScheduleResult }
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
          pathfindingResult.length
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
  }, [pathProperties, simulation, infraId, trainScheduleResult, rollingStock]);

  // setup chart synchronizer
  useEffect(() => {
    if (simulation?.status === 'success' && trainScheduleResult && rollingStock && departureTime) {
      updateChartSynchronizerV2TrainData(simulation, rollingStock, departureTime);
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
