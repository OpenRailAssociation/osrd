import { useMemo } from 'react';

import { omit, sortBy } from 'lodash';

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
      if (correspondingException?.rolling_stock && rollingStockList) {
        const rollingStockName = correspondingException.rolling_stock.rolling_stock_name;
        occurrenceRollingStock = rollingStockList.find((rs) => rs.name === rollingStockName);
      }

      const startTime = correspondingException?.start_time
        ? new Date(correspondingException.start_time.value)
        : computeIndexedOccurrenceStartTime(pacedTrain.startTime, paced.interval, i);

      computedOccurrences.push({
        id: occurrenceId,
        trainName: correspondingException?.train_name?.value ?? computeOccurrenceName(name, i),
        rollingStock: occurrenceRollingStock,
        startTime,
        stopsCount: correspondingException?.path_and_schedule
          ? intermediateStopsCount(correspondingException.path_and_schedule)
          : stopsCount,
        disabled: correspondingException?.disabled,
        // In the model, we can currently have a null category value so we need to handle this case
        category: correspondingException?.rolling_stock_category
          ? correspondingException.rolling_stock_category.value
          : pacedTrainCategory,
        occurrenceIndex: i,
        exception:
          // TODO_EXCEPTION: remove the second check when use TrainScheduleException type
          correspondingException && correspondingException.id
            ? {
                id: correspondingException.id,
                exceptionChangeGroups: omit(correspondingException, [
                  // TODO_EXCEPTION: remove 'key' when use TrainScheduleException type
                  'key',
                  'occurrence_index',
                  'disabled',
                  'summary',
                  'id',
                ]),
              }
            : undefined,

        summary: correspondingException?.summary ?? summary,
      });
    }

    // Handle added exceptions
    exceptions.forEach((exception) => {
      if (exception.occurrence_index !== undefined || !exception.start_time) return;

      let occurrenceRollingStock = rollingStock;
      if (exception.rolling_stock && rollingStockList) {
        const rollingStockName = exception.rolling_stock.rolling_stock_name;
        occurrenceRollingStock = rollingStockList.find((rs) => rs.name === rollingStockName);
      }

      const startTime = new Date(exception.start_time.value);

      computedOccurrences.push({
        // TODO_EXCEPTION: remove `!` when use TrainScheduleException type
        id: formatPacedTrainIdToExceptionId(pacedTrainId, Number(exception.id!)),
        trainName: exception.train_name?.value ?? `${name}/+`,
        rollingStock: occurrenceRollingStock,
        startTime,
        stopsCount: exception.path_and_schedule
          ? intermediateStopsCount(exception.path_and_schedule)
          : stopsCount,
        // In the model, we can currently have a null category value so we need to handle this case
        category: exception.rolling_stock_category
          ? exception.rolling_stock_category.value
          : pacedTrainCategory,

        exception: {
          // TODO_EXCEPTION: remove `!` when use TrainScheduleException type
          id: exception.id!,
          exceptionChangeGroups: omit(exception, [
            // TODO_EXCEPTION: remove 'key' when use TrainScheduleException type
            'key',
            'disabled',
            'occurrence_index',
            'summary',
            'id',
          ]),
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
