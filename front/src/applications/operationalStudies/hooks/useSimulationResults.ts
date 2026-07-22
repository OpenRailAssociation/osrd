import { useEffect, useMemo, useState } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type CorePathfindingResultSuccess,
  type PathProperties,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
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
  formatEditoastIdToTrainScheduleId,
  isOccurrenceId,
} from 'utils/trainId';

import type { SimulationResults } from '../types';
import { preparePathPropertiesData } from '../utils';
import { useScenarioContext } from './useScenarioContext';

/**
 * When several timetable items are selected at once (see `selectedTrainScheduleIds`),
 * fetch the pathfinding result and path properties of each of them so their itineraries
 * can all be displayed on the map at the same time.
 */
const useSelectedTrainSchedulesPaths = (infraId: number, selectedTrainScheduleIds: number[]) => {
  const [getTrainPath] = osrdEditoastApi.endpoints.getTrainPath.useLazyQuery();
  const [getPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useLazyQuery();

  const [selectedPaths, setSelectedPaths] = useState<CorePathfindingResultSuccess[]>([]);
  const [selectedPathsProperties, setSelectedPathsProperties] = useState<PathProperties[]>([]);

  useEffect(() => {
    if (selectedTrainScheduleIds.length < 2) {
      setSelectedPaths([]);
      return;
    }

    let isCancelled = false;
    const fetchSelectedPaths = async () => {
      const pathfindingResults = await Promise.all(
        selectedTrainScheduleIds.map((trainScheduleId) =>
          getTrainPath({
            id: formatEditoastIdToTrainScheduleId(trainScheduleId),
            infraId,
          }).unwrap()
        )
      );
      const successfulPaths = pathfindingResults.filter(
        (path): path is CorePathfindingResultSuccess & { status: 'success' } =>
          path.status === 'success'
      );
      if (!isCancelled) setSelectedPaths(successfulPaths);
    };

    fetchSelectedPaths();
    return () => {
      isCancelled = true;
    };
  }, [selectedTrainScheduleIds, infraId]);

  useEffect(() => {
    if (selectedPaths.length === 0) {
      setSelectedPathsProperties([]);
      return;
    }

    let isCancelled = false;
    const fetchSelectedPathsProperties = async () => {
      const properties = await Promise.all(
        selectedPaths.map((path) =>
          getPathProperties({
            infraId,
            pathPropertiesInput: { track_section_ranges: path.path.track_section_ranges },
          }).unwrap()
        )
      );
      if (!isCancelled) setSelectedPathsProperties(properties);
    };

    fetchSelectedPathsProperties();
    return () => {
      isCancelled = true;
    };
  }, [selectedPaths, infraId]);

  return { selectedPaths, selectedPathsProperties };
};

/**
 * Prepare data to be used in simulation results
 */
const useSimulationResults = (
  trainSchedules: TrainScheduleResponse[] | undefined,
  selectedTrainScheduleIds: number[] = []
): {
  results: SimulationResults | undefined;
  isSimulationDataLoading: boolean;
  selectedPaths: CorePathfindingResultSuccess[];
  selectedPathsProperties: PathProperties[];
} => {
  const { t } = useTranslation('operational-studies');

  const { infraId, electricalProfileSetId } = useScenarioContext();
  const { id: selectedTrainId } = useSelector(getSelectedTrain) || {};

  const { selectedPaths, selectedPathsProperties } = useSelectedTrainSchedulesPaths(
    infraId,
    selectedTrainScheduleIds
  );

  const trainSchedule = useSelectedTrainSchedule(trainSchedules);

  const train: Train | undefined = useMemo(() => {
    if (!selectedTrainId || !trainSchedule) return undefined;

    if (!isOccurrenceId(selectedTrainId) || !trainSchedule.paced) {
      return { ...trainSchedule, id: formatEditoastIdToTrainScheduleId(trainSchedule.id) };
    }

    const exception = findExceptionWithOccurrenceId(
      trainSchedule.paced.exceptions,
      selectedTrainId
    );

    let startTime: number;
    if (exception?.start_time) {
      startTime = exception.start_time.value;
    } else {
      const selectedOccurrenceIndex = extractOccurrenceIndexFromOccurrenceId(selectedTrainId);
      startTime = computeIndexedOccurrenceStartTime(
        new Date(trainSchedule.start_time),
        Duration.parse(trainSchedule.paced.interval),
        selectedOccurrenceIndex
      ).getTime();
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
    return {
      results: undefined,
      isSimulationDataLoading,
      selectedPaths,
      selectedPathsProperties,
    };
  }

  if (pathfinding?.status !== 'success' || !rawPathProperties || !rollingStock) {
    return {
      results: { isValid: false, train, path: pathfinding, rollingStock },
      isSimulationDataLoading,
      selectedPaths,
      selectedPathsProperties,
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
        path: pathfinding,
        pathProperties,
      },
      isSimulationDataLoading,
      selectedPaths,
      selectedPathsProperties,
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
    selectedPaths,
    selectedPathsProperties,
  };
};

export default useSimulationResults;
