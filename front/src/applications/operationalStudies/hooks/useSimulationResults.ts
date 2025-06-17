import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import useSpeedSpaceChart from 'modules/simulationResult/components/SpeedSpaceChart/useSpeedSpaceChart';
import useSelectedTrain from 'modules/trainschedule/hooks/useSelectedTrain';
import { getOperationalStudiesElectricalProfileSetId } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import {
  extractEditoastIdFromTrainScheduleId,
  isOccurrenceId,
  isTrainScheduleId,
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
} from 'utils/trainId';

import type { SimulationResults } from '../types';

/**
 * Prepare data to be used in simulation results
 */
const useSimulationResults = (infraId: number): SimulationResults | undefined => {
  const electricalProfileSetId = useSelector(getOperationalStudiesElectricalProfileSetId);
  const selectedTrainId = useSelector(getSelectedTrainId);

  const editoastSelectedTrainId = useMemo(() => {
    if (!selectedTrainId) return undefined;
    if (isTrainScheduleId(selectedTrainId)) {
      return extractEditoastIdFromTrainScheduleId(selectedTrainId);
    }
    const pacedTrainId = extractPacedTrainIdFromOccurrenceId(selectedTrainId);
    return extractEditoastIdFromPacedTrainId(pacedTrainId);
  }, [selectedTrainId]);

  const train = useSelectedTrain();

  const { data: rawTrainSchedulePath } =
    osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(
      {
        id: editoastSelectedTrainId!,
        infraId,
      },
      {
        skip: !editoastSelectedTrainId || (selectedTrainId && !isTrainScheduleId(selectedTrainId)),
      }
    );

  const { data: rawPacedTrainPath } = osrdEditoastApi.endpoints.getPacedTrainByIdPath.useQuery(
    {
      id: editoastSelectedTrainId!,
      infraId,
    },
    {
      skip: !editoastSelectedTrainId || (selectedTrainId && !isOccurrenceId(selectedTrainId)),
    }
  );
  const path = useMemo(() => {
    if (!selectedTrainId) return undefined;

    if (isTrainScheduleId(selectedTrainId)) {
      return rawTrainSchedulePath?.status === 'success' ? rawTrainSchedulePath : undefined;
    }
    return rawPacedTrainPath?.status === 'success' ? rawPacedTrainPath : undefined;
  }, [selectedTrainId, rawTrainSchedulePath, rawPacedTrainPath]);

  const { data: selectedTrainScheduleSimulation } =
    osrdEditoastApi.endpoints.getTrainScheduleByIdSimulation.useQuery(
      { id: editoastSelectedTrainId!, infraId, electricalProfileSetId },
      {
        skip: !editoastSelectedTrainId || (selectedTrainId && !isTrainScheduleId(selectedTrainId)),
      }
    );

  const { data: selectedPacedTrainSimulation } =
    osrdEditoastApi.endpoints.getPacedTrainByIdSimulation.useQuery(
      {
        id: editoastSelectedTrainId!,
        infraId,
        electricalProfileSetId,
      },
      {
        skip: !editoastSelectedTrainId || (selectedTrainId && !isOccurrenceId(selectedTrainId)),
      }
    );

  const selectedTimetableItemSimulationData = useMemo(() => {
    if (!selectedTrainId || !train) return undefined;

    return {
      train,
      selectedTimetableItemSimulation: isTrainScheduleId(selectedTrainId)
        ? selectedTrainScheduleSimulation
        : selectedPacedTrainSimulation,
    };
  }, [selectedTrainId, train, selectedTrainScheduleSimulation, selectedPacedTrainSimulation]);

  const speedSpaceChart = useSpeedSpaceChart(
    selectedTimetableItemSimulationData?.train,
    path,
    selectedTimetableItemSimulationData?.selectedTimetableItemSimulation
  );

  if (
    selectedTimetableItemSimulationData?.selectedTimetableItemSimulation?.status !== 'success' ||
    !speedSpaceChart ||
    !path
  )
    return undefined;

  return {
    train: selectedTimetableItemSimulationData.train,
    rollingStock: speedSpaceChart.rollingStock,
    powerRestrictions: speedSpaceChart.formattedPowerRestrictions || [],
    simulation: selectedTimetableItemSimulationData.selectedTimetableItemSimulation,
    pathProperties: speedSpaceChart.formattedPathProperties,
    path,
  };
};

export default useSimulationResults;
