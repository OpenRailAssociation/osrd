import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import formatPowerRestrictionRangesWithHandled from 'modules/powerRestriction/helpers/formatPowerRestrictionRangesWithHandled';
import useSelectedTrain from 'modules/trainschedule/hooks/useSelectedTrain';
import { getOperationalStudiesElectricalProfileSetId } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';

import type { SimulationResults } from '../types';
import { preparePathPropertiesData } from '../utils';

/**
 * Prepare data to be used in simulation results
 */
const useSimulationResults = (infraId: number): SimulationResults | undefined => {
  const { t } = useTranslation('operational-studies');

  const electricalProfileSetId = useSelector(getOperationalStudiesElectricalProfileSetId);
  const selectedTrainId = useSelector(getSelectedTrainId);

  const train = useSelectedTrain();

  const { data: pathfinding } = osrdEditoastApi.endpoints.getTrainPath.useQuery(
    {
      id: selectedTrainId!,
      infraId,
    },
    {
      skip: !selectedTrainId,
    }
  );

  const { data: simulation } = osrdEditoastApi.endpoints.getTrainSimulation.useQuery(
    {
      id: selectedTrainId!,
      infraId,
      electricalProfileSetId,
    },
    {
      skip: !selectedTrainId,
    }
  );

  // TODO: replace this API call by extracting the rolling stock from the rolling
  // stocks list
  const { data: rollingStock } =
    osrdEditoastApi.endpoints.getRollingStockNameByRollingStockName.useQuery(
      {
        rollingStockName: train?.rolling_stock_name || '',
      },
      {
        skip: !train,
      }
    );

  const { data: rawPathProperties } =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useQuery(
      {
        infraId,
        props: ['electrifications', 'geometry', 'operational_points', 'curves', 'slopes'],
        pathPropertiesInput: {
          track_section_ranges:
            pathfinding?.status === 'success' ? pathfinding.track_section_ranges : [],
        },
      },
      { skip: pathfinding?.status !== 'success' }
    );

  if (
    !train ||
    pathfinding?.status !== 'success' ||
    simulation?.status !== 'success' ||
    !rawPathProperties ||
    !rollingStock
  ) {
    return undefined;
  }

  const pathProperties = preparePathPropertiesData(
    simulation.electrical_profiles,
    rawPathProperties,
    pathfinding,
    train.path,
    t
  );

  const powerRestrictions =
    formatPowerRestrictionRangesWithHandled({
      selectedTimetableItem: train,
      selectedTrainRollingStock: rollingStock,
      pathfindingResult: pathfinding,
      pathProperties,
    }) ?? [];

  return {
    train,
    rollingStock,
    simulation,
    path: pathfinding,
    pathProperties,
    powerRestrictions,
  };
};

export default useSimulationResults;
