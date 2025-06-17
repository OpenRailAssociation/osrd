import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import useSpeedSpaceChart from 'modules/simulationResult/components/SpeedSpaceChart/useSpeedSpaceChart';
import useSelectedTrain from 'modules/trainschedule/hooks/useSelectedTrain';
import { getOperationalStudiesElectricalProfileSetId } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';

import type { SimulationResults } from '../types';

/**
 * Prepare data to be used in simulation results
 */
const useSimulationResults = (infraId: number): SimulationResults | undefined => {
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

  const selectedTimetableItemSimulationData = useMemo(() => {
    if (
      !selectedTrainId ||
      !train ||
      pathfinding?.status !== 'success' ||
      simulation?.status !== 'success'
    )
      return undefined;

    return {
      train,
      path: pathfinding,
      simulation,
    };
  }, [selectedTrainId, train, pathfinding, simulation]);

  const speedSpaceChart = useSpeedSpaceChart(
    selectedTimetableItemSimulationData?.train,
    selectedTimetableItemSimulationData?.path,
    selectedTimetableItemSimulationData?.simulation
  );

  if (!selectedTimetableItemSimulationData || !speedSpaceChart) return undefined;

  return {
    train: selectedTimetableItemSimulationData.train,
    rollingStock: speedSpaceChart.rollingStock,
    powerRestrictions: speedSpaceChart.formattedPowerRestrictions || [],
    simulation: selectedTimetableItemSimulationData.simulation,
    pathProperties: speedSpaceChart.formattedPathProperties,
    path: selectedTimetableItemSimulationData.path,
  };
};

export default useSimulationResults;
