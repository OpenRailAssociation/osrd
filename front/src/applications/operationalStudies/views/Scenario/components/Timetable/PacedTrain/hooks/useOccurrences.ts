import { useMemo } from 'react';

import { omit, sortBy } from 'lodash';

import { type LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import {
  findExceptionWithOccurrenceId,
  getOccurrencesNb,
  computeIndexedOccurrenceStartTime,
} from 'modules/timetableItem/helpers/pacedTrain';
import type { Occurrence, PacedTrainWithDetails } from 'modules/timetableItem/types';
import {
  formatPacedTrainIdToExceptionId,
  formatPacedTrainIdToIndexedOccurrenceId,
} from 'utils/trainId';

const useOccurrences = (
  pacedTrain: PacedTrainWithDetails,
  rollingStockList: LightRollingStockWithLiveries[] | null
) => {
  const {
    id,
    paced,
    name,
    rollingStock,
    stopsCount,
    summary,
    exceptions,
    category: pacedTrainCategory,
  } = pacedTrain;

  const occurrencesCount = getOccurrencesNb(paced);

  const occurrences = useMemo(() => {
    const computedOccurrences: Occurrence[] = [];

    // Handle indexed occurrences
    for (let i = 0; i < occurrencesCount; i += 1) {
      const occurrenceId = formatPacedTrainIdToIndexedOccurrenceId(id, i);

      const correspondingException = findExceptionWithOccurrenceId(exceptions, occurrenceId);

      let occurrenceRollingStock = rollingStock;
      if (correspondingException?.rolling_stock && rollingStockList) {
        const rollingStockName = correspondingException.rolling_stock.rolling_stock_name;
        occurrenceRollingStock = rollingStockList.find((rs) => rs.name === rollingStockName);
      }

      const startTime = correspondingException?.start_time?.value
        ? new Date(correspondingException.start_time.value)
        : computeIndexedOccurrenceStartTime(pacedTrain.startTime, paced.interval, i);

      computedOccurrences.push({
        id: occurrenceId,
        trainName: correspondingException?.train_name?.value ?? computeOccurrenceName(name, i),
        rollingStock: occurrenceRollingStock,
        startTime,
        stopsCount: correspondingException?.path_and_schedule
          ? correspondingException.path_and_schedule.schedule.filter((step) => step.stop_for).length
          : stopsCount,
        disabled: correspondingException?.disabled,
        // In the model, we can currently have a null category value so we need to handle this case
        category: correspondingException?.rolling_stock_category
          ? correspondingException.rolling_stock_category.value
          : pacedTrainCategory,
        occurrenceIndex: i,
        exceptionChangeGroups: correspondingException
          ? omit(correspondingException, ['key', 'occurrence_index', 'disabled', 'summary'])
          : undefined,
        summary: correspondingException?.summary ?? summary,
      });
    }

    // Handle added exceptions
    exceptions.forEach((exception) => {
      if (exception.occurrence_index !== undefined) return;

      let occurrenceRollingStock = rollingStock;
      if (exception.rolling_stock && rollingStockList) {
        const rollingStockName = exception.rolling_stock.rolling_stock_name;
        occurrenceRollingStock = rollingStockList.find((rs) => rs.name === rollingStockName);
      }

      // An added exception will always have a least a start time in its exceptions
      const startTime = new Date(exception.start_time!.value);

      computedOccurrences.push({
        id: formatPacedTrainIdToExceptionId(id, exception.key),
        trainName: exception.train_name?.value ?? `${name}/+`,
        rollingStock: occurrenceRollingStock,
        startTime,
        stopsCount: exception.path_and_schedule
          ? exception.path_and_schedule.schedule.filter((step) => step.stop_for).length
          : stopsCount,
        // In the model, we can currently have a null category value so we need to handle this case
        category: exception.rolling_stock_category
          ? exception.rolling_stock_category.value
          : pacedTrainCategory,
        exceptionChangeGroups: omit(exception, ['key', 'disabled', 'occurrence_index', 'summary']),
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
