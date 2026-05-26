import { useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { osrdEditoastApi, type TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import formatPowerRestrictionRangesWithHandled from 'modules/powerRestriction/helpers/formatPowerRestrictionRangesWithHandled';
import {
  extractOccurrenceDetailsFromPacedTrain,
  findExceptionWithOccurrenceId,
  computeIndexedOccurrenceStartTime,
  getOccurrenceTrainName,
} from 'modules/trainSchedule/helpers/pacedTrain';
import useSelectedTrainSchedule from 'modules/trainSchedule/hooks/useSelectedTrainSchedule';
import type { Train } from 'reducers/osrdconf/types';
import { getSelectedTrain } from 'reducers/simulationResults/selectors';
import { Duration } from 'utils/duration';
import {
  extractOccurrenceIndexFromOccurrenceId,
  formatEditoastIdToPacedTrainId,
  isOccurrenceId,
} from 'utils/trainId';

import type { SimulationResults } from '../types';
import { preparePathPropertiesData } from '../utils';
import { useScenarioContext } from './useScenarioContext';

/**
 * Prepare data to be used in simulation results
 */
const useSimulationResults = (
  trainSchedules: TrainScheduleResponse[] | undefined
): {
  results: SimulationResults | undefined;
  isSimulationDataLoading: boolean;
} => {
  const { t } = useTranslation('operational-studies');

  const { infraId, electricalProfileSetId } = useScenarioContext();
  const { id: selectedTrainId } = useSelector(getSelectedTrain) || {};

  const trainSchedule = useSelectedTrainSchedule(trainSchedules);

  const train: Train | undefined = useMemo(() => {
    if (!selectedTrainId || !trainSchedule) return undefined;

    if (!isOccurrenceId(selectedTrainId) || !trainSchedule.paced) {
      return { ...trainSchedule, id: formatEditoastIdToPacedTrainId(trainSchedule.id) };
    }

    const exception = findExceptionWithOccurrenceId(
      trainSchedule.paced.exceptions,
      selectedTrainId
    );

    let startTime: string;
    if (exception?.start_time) {
      startTime = exception.start_time.value;
    } else {
      const selectedOccurrenceIndex = extractOccurrenceIndexFromOccurrenceId(selectedTrainId);
      startTime = computeIndexedOccurrenceStartTime(
        new Date(trainSchedule.start_time),
        Duration.parse(trainSchedule.paced.interval),
        selectedOccurrenceIndex
      ).toISOString();
    }

    return {
      ...trainSchedule,
      ...(exception ? extractOccurrenceDetailsFromPacedTrain(trainSchedule, exception) : {}),
      // overwrite start_time from extractOccurrenceDetailsFromPacedTrain
      start_time: startTime,
      // overwrite train_name to reflect the occurrence name
      train_name: getOccurrenceTrainName(
        { train_name: trainSchedule.train_name, paced: trainSchedule.paced },
        selectedTrainId
      ),
      id: selectedTrainId,
    };
  }, [selectedTrainId, trainSchedule]);

  const exception = useMemo(() => {
    if (!selectedTrainId || !isOccurrenceId(selectedTrainId) || !trainSchedule?.paced)
      return undefined;
    return findExceptionWithOccurrenceId(trainSchedule.paced.exceptions, selectedTrainId);
  }, [selectedTrainId, trainSchedule]);

  const { currentData: pathfinding, isFetching: isPathfindingFetching } =
    osrdEditoastApi.endpoints.getTrainPath.useQuery(
      selectedTrainId
        ? {
            id: selectedTrainId,
            infraId,
            exceptionId: exception?.id ?? undefined,
          }
        : skipToken
    );

  const { currentData: simulation, isFetching: isSimulationFetching } =
    osrdEditoastApi.endpoints.getTrainSimulation.useQuery(
      selectedTrainId
        ? {
            id: selectedTrainId,
            infraId,
            electricalProfileSetId,
            exceptionId: exception?.id ?? undefined,
          }
        : skipToken
    );

  // TODO: replace this API call by extracting the rolling stock from the rolling
  // stocks list
  const { currentData: rollingStock } =
    osrdEditoastApi.endpoints.getRollingStockNameByRollingStockName.useQuery(
      train?.rolling_stock_name
        ? {
            rollingStockName: train.rolling_stock_name,
          }
        : skipToken
    );

  const { currentData: rawPathProperties, isFetching: isPathPropertiesFetching } =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useQuery(
      pathfinding?.status === 'success'
        ? {
            infraId,
            pathPropertiesInput: {
              track_section_ranges: pathfinding.path.track_section_ranges,
            },
          }
        : skipToken
    );

  const isSimulationDataLoading =
    isPathfindingFetching || isSimulationFetching || isPathPropertiesFetching;

  if (!train || exception?.disabled) {
    return { results: undefined, isSimulationDataLoading };
  }

  if (pathfinding?.status !== 'success' || !rawPathProperties || !rollingStock) {
    return {
      results: { isValid: false, train, rollingStock },
      isSimulationDataLoading,
    };
  }

  const pathProperties = preparePathPropertiesData(
    simulation?.status === 'success' ? simulation.electrical_profiles : undefined,
    rawPathProperties,
    pathfinding,
    train.path,
    t
  );

  if (simulation?.status !== 'success') {
    return {
      results: {
        isValid: false,
        train,
        rollingStock,
        pathProperties,
      },
      isSimulationDataLoading,
    };
  }

  const powerRestrictions =
    formatPowerRestrictionRangesWithHandled({
      selectedTrainSchedule: train,
      selectedTrainRollingStock: rollingStock,
      pathfindingResult: pathfinding,
      pathProperties,
    }) ?? [];

  return {
    results: {
      isValid: true,
      train,
      rollingStock,
      simulation,
      path: pathfinding,
      pathProperties,
      powerRestrictions,
    },
    isSimulationDataLoading,
  };
};

export default useSimulationResults;
