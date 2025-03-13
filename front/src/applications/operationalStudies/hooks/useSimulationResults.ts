import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import useSpeedSpaceChart from 'modules/simulationResult/components/SpeedSpaceChart/useSpeedSpaceChart';
import { getOperationalStudiesElectricalProfileSetId } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { TrainScheduleId } from 'reducers/osrdconf/types';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { formatTrainScheduleIdToEditoastTrainId } from 'utils/trainId';

import type { SimulationResultsData } from '../types';

/**
 * Prepare data to be used in simulation results
 */
const useSimulationResults = (): SimulationResultsData => {
  const infraId = useInfraID();
  const electricalProfileSetId = useSelector(getOperationalStudiesElectricalProfileSetId);
  const selectedTrainId = useSelector(getSelectedTrainId);

  // TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/11054
  const editoastSelectedTrainId = selectedTrainId
    ? formatTrainScheduleIdToEditoastTrainId(selectedTrainId as TrainScheduleId)
    : undefined;

  const { data: selectedTrainSchedule } = osrdEditoastApi.endpoints.getTrainScheduleById.useQuery(
    {
      id: editoastSelectedTrainId!,
    },
    { skip: !editoastSelectedTrainId }
  );

  const { data: rawPath } = osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(
    {
      id: editoastSelectedTrainId!,
      infraId: infraId!,
    },
    { skip: !editoastSelectedTrainId || !infraId }
  );
  const path = selectedTrainId && rawPath?.status === 'success' ? rawPath : undefined;

  const { data: trainSimulation } =
    osrdEditoastApi.endpoints.getTrainScheduleByIdSimulation.useQuery(
      { id: editoastSelectedTrainId!, infraId: infraId!, electricalProfileSetId },
      { skip: !editoastSelectedTrainId || !infraId }
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
