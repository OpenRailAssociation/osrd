import { useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import formatPowerRestrictionRangesWithHandled from 'modules/powerRestriction/helpers/formatPowerRestrictionRangesWithHandled';
import {
  extractOccurrenceDetailsFromPacedTrain,
  findExceptionWithOccurrenceId,
  computeIndexedOccurrenceStartTime,
} from 'modules/timetableItem/helpers/pacedTrain';
import useSelectedTimetableItem from 'modules/timetableItem/hooks/useSelectedTimetableItem';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { Duration } from 'utils/duration';
import {
  extractOccurrenceIndexFromOccurrenceId,
  isPacedTrainResponseWithPacedTrainId,
  isTrainScheduleId,
} from 'utils/trainId';

import type { SimulationResults } from '../types';
import { preparePathPropertiesData } from '../utils';
import { useScenarioContext } from './useScenarioContext';

/**
 * Prepare data to be used in simulation results
 */
const useSimulationResults = (): SimulationResults | undefined => {
  const { t } = useTranslation('operational-studies');

  const { infraId, electricalProfileSetId } = useScenarioContext();
  const selectedTrainId = useSelector(getSelectedTrainId);

  const timetableItem = useSelectedTimetableItem();

  const train = useMemo(() => {
    if (!selectedTrainId || !timetableItem) return undefined;
    if (!isPacedTrainResponseWithPacedTrainId(timetableItem)) {
      return timetableItem;
    }

    if (isTrainScheduleId(selectedTrainId)) {
      throw new Error(`trainId ${selectedTrainId} should be a occurrence id`);
    }

    const exception = findExceptionWithOccurrenceId(timetableItem.exceptions, selectedTrainId);

    let startTime: string;
    if (exception?.start_time) {
      startTime = exception.start_time.value;
    } else {
      const selectedOccurrenceIndex = extractOccurrenceIndexFromOccurrenceId(selectedTrainId);
      startTime = computeIndexedOccurrenceStartTime(
        new Date(timetableItem.start_time),
        Duration.parse(timetableItem.paced.interval),
        selectedOccurrenceIndex
      ).toISOString();
    }

    return {
      ...timetableItem,
      ...(exception ? extractOccurrenceDetailsFromPacedTrain(timetableItem, exception) : {}),
      // overwrite start_time from extractOccurrenceDetailsFromPacedTrain
      start_time: startTime,
      id: selectedTrainId,
    };
  }, [selectedTrainId, timetableItem]);

  const exception = useMemo(() => {
    if (!selectedTrainId || !timetableItem || !isPacedTrainResponseWithPacedTrainId(timetableItem))
      return undefined;
    if (isTrainScheduleId(selectedTrainId))
      throw new Error(`trainId ${selectedTrainId} should be a occurrence id`);
    return findExceptionWithOccurrenceId(timetableItem.exceptions, selectedTrainId);
  }, [selectedTrainId, timetableItem]);

  const { currentData: pathfinding } = osrdEditoastApi.endpoints.getTrainPath.useQuery(
    selectedTrainId
      ? {
          id: selectedTrainId,
          infraId,
          exceptionKey: exception?.key,
        }
      : skipToken
  );

  const { currentData: simulation } = osrdEditoastApi.endpoints.getTrainSimulation.useQuery(
    selectedTrainId
      ? {
          id: selectedTrainId,
          infraId,
          electricalProfileSetId,
          exceptionKey: exception?.key,
        }
      : skipToken
  );

  // TODO: replace this API call by extracting the rolling stock from the rolling
  // stocks list
  const { currentData: rollingStock } =
    osrdEditoastApi.endpoints.getRollingStockNameByRollingStockName.useQuery(
      train
        ? {
            rollingStockName: train.rolling_stock_name,
          }
        : skipToken
    );

  const { currentData: rawPathProperties } =
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

  if (!train || exception?.disabled) {
    return undefined;
  }

  if (
    pathfinding?.status !== 'success' ||
    simulation?.status !== 'success' ||
    !rawPathProperties ||
    !rollingStock
  ) {
    return { isValid: false, train, rollingStock };
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
    isValid: true,
    train,
    rollingStock,
    simulation,
    path: pathfinding,
    pathProperties,
    powerRestrictions,
  };
};

export default useSimulationResults;
