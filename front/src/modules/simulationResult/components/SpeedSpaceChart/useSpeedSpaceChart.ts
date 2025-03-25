import { useEffect, useState } from 'react';

import type { LayerData, PowerRestrictionValues } from '@osrd-project/ui-charts';
import { useTranslation } from 'react-i18next';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import { preparePathPropertiesData } from 'applications/operationalStudies/utils';
import {
  osrdEditoastApi,
  type PathfindingResultSuccess,
  type SimulationResponse,
} from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import usePathProperties from 'modules/pathfinding/hooks/usePathProperties';
import formatPowerRestrictionRangesWithHandled from 'modules/powerRestriction/helpers/formatPowerRestrictionRangesWithHandled';
import type { SpeedSpaceChartData } from 'modules/simulationResult/types';
import type { TimetableItemWithTimetableId } from 'reducers/osrdconf/types';

import { updateChartSynchronizerTrainData } from '../ChartSynchronizer/utils';

/** Prepare data needed for speedSpaceChart */
const useSpeedSpaceChart = (
  timetableItem?: TimetableItemWithTimetableId,
  pathfindingResult?: PathfindingResultSuccess,
  simulation?: SimulationResponse,
  departureTime?: string
): SpeedSpaceChartData | null => {
  const { t } = useTranslation('simulation');
  const infraId = useInfraID();

  const [formattedPathProperties, setFormattedPathProperties] = useState<PathPropertiesFormatted>();
  const [formattedPowerRestrictions, setFormattedPowerRestrictions] =
    useState<LayerData<PowerRestrictionValues>[]>();

  const rollingStockName = timetableItem?.rolling_stock_name;
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
        timetableItem &&
        rollingStock &&
        pathfindingResult &&
        simulation?.status === 'success' &&
        pathProperties
      ) {
        const formattedPathProps = preparePathPropertiesData(
          simulation.electrical_profiles,
          pathProperties,
          pathfindingResult,
          timetableItem.path,
          t
        );

        setFormattedPathProperties(formattedPathProps);
      }
    };

    getPathProperties();
  }, [infraId, timetableItem, rollingStock, pathfindingResult, simulation?.status, pathProperties]);

  useEffect(() => {
    if (timetableItem && rollingStock && pathfindingResult && formattedPathProperties) {
      const powerRestrictions = formatPowerRestrictionRangesWithHandled({
        selectedTimetableItem: timetableItem,
        selectedTrainRollingStock: rollingStock,
        pathfindingResult,
        pathProperties: formattedPathProperties,
      });
      setFormattedPowerRestrictions(powerRestrictions);
    }
  }, [formattedPathProperties, timetableItem]);

  // setup chart synchronizer
  useEffect(() => {
    if (simulation?.status === 'success' && timetableItem && rollingStock && departureTime) {
      updateChartSynchronizerTrainData(simulation, rollingStock, departureTime);
    }
  }, [simulation, timetableItem, rollingStock, departureTime]);

  return timetableItem &&
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
