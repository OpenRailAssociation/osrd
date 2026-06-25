import { useMemo } from 'react';

import { sortBy } from 'lodash';

import { intermediateStopsCount } from 'applications/operationalStudies/utils';
import { type LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/trainSchedule/helpers/computeOccurrenceName';
import {
  findExceptionWithOccurrenceId,
  getOccurrencesNb,
  computeIndexedOccurrenceStartTime,
} from 'modules/trainSchedule/helpers/pacedTrain';
import type { Occurrence, PacedTrainWithPacedWithDetails } from 'modules/trainSchedule/types';
import {
  formatEditoastIdToPacedTrainId,
  formatPacedTrainIdToExceptionId,
  formatPacedTrainIdToIndexedOccurrenceId,
} from 'utils/trainId';

const useOccurrences = (
  pacedTrain: PacedTrainWithPacedWithDetails,
  rollingStockList: LightRollingStockWithLiveries[] | null
) => {
  const {
    id,
    paced,
    name,
    rollingStock,
    stopsCount,
    summary,
    category: pacedTrainCategory,
  } = pacedTrain;
  const { exceptions } = paced;

  const occurrencesCount = getOccurrencesNb(paced);

  const occurrences = useMemo(() => {
    const computedOccurrences: Occurrence[] = [];
    const pacedTrainId = formatEditoastIdToPacedTrainId(id);

    // Handle indexed occurrences
    for (let i = 0; i < occurrencesCount; i += 1) {
      const occurrenceId = formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, i);

      const correspondingException = findExceptionWithOccurrenceId(exceptions, occurrenceId);

      let occurrenceRollingStock = rollingStock;
      if (correspondingException?.change_groups.rolling_stock && rollingStockList) {
        const rollingStockName =
          correspondingException.change_groups.rolling_stock.rolling_stock_name;
        occurrenceRollingStock = rollingStockList.find((rs) => rs.name === rollingStockName);
      }

      const startTime = correspondingException?.change_groups.start_time?.value
        ? new Date(correspondingException.change_groups.start_time.value)
        : computeIndexedOccurrenceStartTime(pacedTrain.startTime, paced.interval, i);

      computedOccurrences.push({
        id: occurrenceId,
        trainName:
          correspondingException?.change_groups.train_name?.value ?? computeOccurrenceName(name, i),
        rollingStock: occurrenceRollingStock,
        startTime,
        stopsCount: correspondingException?.change_groups.path_and_schedule
          ? intermediateStopsCount(correspondingException.change_groups.path_and_schedule)
          : stopsCount,
        disabled: correspondingException?.disabled,
        // In the model, we can currently have a null category value so we need to handle this case
        category: correspondingException?.change_groups.rolling_stock_category
          ? correspondingException.change_groups.rolling_stock_category.value
          : pacedTrainCategory,
        occurrenceIndex: i,
        exception: correspondingException
          ? {
              id: correspondingException.id,
              exceptionChangeGroups: correspondingException.change_groups,
            }
          : undefined,

        summary: correspondingException?.summary ?? summary,
      });
    }

    // Handle added exceptions
    exceptions.forEach((exception) => {
      if (exception.occurrence_index !== undefined || !exception.change_groups.start_time) return;

      let occurrenceRollingStock = rollingStock;
      if (exception.change_groups.rolling_stock && rollingStockList) {
        const rollingStockName = exception.change_groups.rolling_stock.rolling_stock_name;
        occurrenceRollingStock = rollingStockList.find((rs) => rs.name === rollingStockName);
      }

      const startTime = new Date(exception.change_groups.start_time.value);

      computedOccurrences.push({
        id: formatPacedTrainIdToExceptionId(pacedTrainId, Number(exception.id)),
        trainName: exception.change_groups.train_name?.value ?? `${name}/+`,
        rollingStock: occurrenceRollingStock,
        startTime,
        stopsCount: exception.change_groups.path_and_schedule
          ? intermediateStopsCount(exception.change_groups.path_and_schedule)
          : stopsCount,
        // In the model, we can currently have a null category value so we need to handle this case
        category: exception.change_groups.rolling_stock_category
          ? exception.change_groups.rolling_stock_category.value
          : pacedTrainCategory,

        exception: {
          id: exception.id,
          exceptionChangeGroups: exception.change_groups,
        },

        summary: exception.summary ?? summary,
      });
    });
    return sortBy(computedOccurrences, 'startTime');
  }, [pacedTrain, rollingStockList]);

  // Add to the count the added exceptions and substract the disabled ones
  const occurrenceCountLabel = useMemo(
    () =>
      exceptions.reduce((acc, exception) => {
        if (exception.disabled) acc -= 1;
        return acc;
      }, occurrences.length),
    [occurrences.length, exceptions]
  );

  return { occurrencesCount: occurrenceCountLabel, occurrences };
};

export default useOccurrences;
