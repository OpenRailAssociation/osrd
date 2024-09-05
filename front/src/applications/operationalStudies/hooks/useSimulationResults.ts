import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdConfSelectors } from 'common/osrdContext';
import useSpeedSpaceChart from 'modules/simulationResult/components/SpeedSpaceChart/useSpeedSpaceChart';
import { getSelectedTrainId } from 'reducers/osrdsimulation/selectors';

import type { SimulationResultsData } from '../types';

/**
 * Prepare data to be used in simulation results
 */
const useSimulationResults = (): SimulationResultsData => {
  const infraId = useInfraID();
  const { getElectricalProfileSetId } = useOsrdConfSelectors();
  const electricalProfileSetId = useSelector(getElectricalProfileSetId);
  const selectedTrainId = useSelector(getSelectedTrainId);

  const { data: selectedTrainSchedule } = osrdEditoastApi.endpoints.getTrainScheduleById.useQuery(
    {
      id: selectedTrainId as number,
    },
    { skip: !selectedTrainId }
  );

  const { data: rawPath } = osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(
    {
      id: selectedTrainId as number,
      infraId: infraId as number,
    },
    { skip: !selectedTrainId || !infraId }
  );
  const path = selectedTrainId && rawPath?.status === 'success' ? rawPath : undefined;

  const { data: trainSimulation } =
    osrdEditoastApi.endpoints.getTrainScheduleByIdSimulation.useQuery(
      { id: selectedTrainId as number, infraId: infraId as number, electricalProfileSetId },
      { skip: !selectedTrainId || !infraId }
    );

  const speedSpaceChart = useSpeedSpaceChart(
    (selectedTrainId && selectedTrainSchedule) || undefined,
    path,
    (selectedTrainId && trainSimulation) || undefined,
    (selectedTrainId && selectedTrainSchedule?.start_time) || undefined
  );

  if (!selectedTrainId)
    return {
      selectedTrainPowerRestrictions: [],
    };

  return {
    selectedTrainSchedule,
    selectedTrainRollingStock: speedSpaceChart?.rollingStock,
    selectedTrainPowerRestrictions: speedSpaceChart?.formattedPowerRestrictions || [],
    trainSimulation: speedSpaceChart?.simulation,
    pathProperties: speedSpaceChart?.formattedPathProperties,
    pathLength: path?.length,
    path,
  };
};

export default useSimulationResults;
