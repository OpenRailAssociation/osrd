import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import useSpeedSpaceChart from 'modules/simulationResult/components/SpeedSpaceChart/useSpeedSpaceChart';
import { getSelectedTrainId } from 'reducers/osrdsimulation/selectors';

/**
 * Prepare data to be used in simulation results
 */
const useSimulationResults = () => {
  const infraId = useInfraID();
  const selectedTrainId = useSelector(getSelectedTrainId);

  const { data: selectedTrainSchedule } = osrdEditoastApi.endpoints.getV2TrainScheduleById.useQuery(
    {
      id: selectedTrainId as number,
    },
    { skip: !selectedTrainId }
  );

  const { data: path } = osrdEditoastApi.endpoints.getV2TrainScheduleByIdPath.useQuery(
    {
      id: selectedTrainId as number,
      infraId: infraId as number,
    },
    { skip: !selectedTrainId || !infraId }
  );
  const pathfindingResultSuccess = path?.status === 'success' ? path : undefined;

  const { data: trainSimulation } =
    osrdEditoastApi.endpoints.getV2TrainScheduleByIdSimulation.useQuery(
      { id: selectedTrainId as number, infraId: infraId as number },
      { skip: !selectedTrainId || !infraId }
    );

  const speedSpaceChart = useSpeedSpaceChart(
    selectedTrainSchedule,
    pathfindingResultSuccess,
    trainSimulation,
    selectedTrainSchedule?.start_time
  );

  return {
    selectedTrainSchedule,
    selectedTrainRollingStock: speedSpaceChart?.rollingStock,
    selectedTrainPowerRestrictions: speedSpaceChart?.formattedPowerRestrictions || [],
    trainSimulation: speedSpaceChart?.simulation,
    pathProperties: speedSpaceChart?.formattedPathProperties,
    pathLength: pathfindingResultSuccess?.length,
  };
};

export default useSimulationResults;
