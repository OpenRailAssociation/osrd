import { useEffect, useState } from 'react';

import dayjs from 'dayjs';
import { omit, sortBy } from 'lodash';

import { osrdEditoastApi, type LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/trainschedule/helpers/computeOccurrenceName';
import {
  findExceptionWithOccurrenceId,
  getOccurrencesNb,
} from 'modules/trainschedule/helpers/pacedTrain';
import {
  formatPacedTrainIdToExceptionId,
  formatPacedTrainIdToIndexedOccurrenceId,
} from 'utils/trainId';

import type { Occurrence, PacedTrainWithDetails } from '../../types';

const useOccurrences = (
  pacedTrain: PacedTrainWithDetails,
  rollingStockList: LightRollingStockWithLiveries[] | null
) => {
  const {
    id,
    paced,
    startTime,
    arrivalTime,
    name,
    rollingStock,
    stopsCount,
    mechanicalEnergyConsumed,
    pathLength,
    duration,
    isValid,
    invalidReason,
    exceptions,
    category: pacedTrainCategory,
  } = pacedTrain;

  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const occurrencesCount = getOccurrencesNb(paced);

  // Add to the count the added exceptions and substract the disabled ones
  const occurrenceCountLabel = exceptions.reduce((acc, exception) => {
    if (exception.disabled) acc -= 1;
    return acc;
  }, occurrences.length);

  const [getRollingStockByName] =
    osrdEditoastApi.endpoints.getRollingStockNameByRollingStockName.useLazyQuery();

  useEffect(() => {
    const buildOccurrences = async () => {
      const computedOccurrences: Occurrence[] = [];

      // Handle indexed occurrences
      for (let i = 0; i < occurrencesCount; i += 1) {
        const occurrenceId = formatPacedTrainIdToIndexedOccurrenceId(id, i);
        const occurrenceStartTime = dayjs(startTime)
          .add(i * paced.interval.ms, 'ms')
          .toDate();
        const occurrenceArrivalTime = dayjs(arrivalTime)
          .add(i * paced.interval.ms, 'ms')
          .toDate();

        const correspondingException = findExceptionWithOccurrenceId(exceptions, occurrenceId);

        let occurrenceRollingStock = rollingStock;
        if (correspondingException?.rolling_stock) {
          const promisedRollingStock = getRollingStockByName({
            rollingStockName: correspondingException.rolling_stock.rolling_stock_name,
          });
          occurrenceRollingStock = await promisedRollingStock.unwrap();
          // we don't want to subscribe to the endpoint to prevent unnecessary calls
          promisedRollingStock.unsubscribe();
        }

        computedOccurrences.push({
          id: occurrenceId,
          trainName: correspondingException?.train_name?.value ?? computeOccurrenceName(name, i),
          rollingStock: occurrenceRollingStock,
          startTime: correspondingException?.start_time?.value
            ? new Date(correspondingException.start_time.value)
            : occurrenceStartTime,
          stopsCount: correspondingException?.path_and_schedule
            ? correspondingException.path_and_schedule.schedule.filter((step) => step.stop_for)
                .length
            : stopsCount,
          disabled: correspondingException?.disabled,
          // In the model, we can currently have a null category value so we need to handle this case
          category: correspondingException?.rolling_stock_category
            ? correspondingException.rolling_stock_category.value
            : pacedTrainCategory,
          occurrenceIndex: i,
          exceptionChangeGroups: correspondingException
            ? omit(correspondingException, ['key', 'occurrence_index', 'disabled'])
            : undefined,
          ...(isValid
            ? {
                isValid: true,
                // TODO exceptions : update the arrival time if the exception is in the paced train summaries
                arrivalTime: occurrenceArrivalTime,
                pathLength,
                mechanicalEnergyConsumed,
                duration,
              }
            : {
                isValid: false,
                invalidReason,
              }),
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

        computedOccurrences.push({
          id: formatPacedTrainIdToExceptionId(id, exception.key),
          trainName: exception.train_name?.value ?? `${name}/+`,
          rollingStock: occurrenceRollingStock,
          // An added exception will always have a least a start time in its exceptions
          startTime: new Date(exception.start_time!.value),
          stopsCount: exception.path_and_schedule
            ? exception.path_and_schedule.schedule.filter((step) => step.stop_for).length
            : stopsCount,
          // In the model, we can currently have a null category value so we need to handle this case
          category: exception.rolling_stock_category
            ? exception.rolling_stock_category.value
            : pacedTrainCategory,
          exceptionChangeGroups: omit(exception, ['key', 'disabled', 'occurrence_index']),
          ...(isValid
            ? {
                isValid: true,
                // TODO exceptions : update the arrival time if the exception is in the paced train summaries
                arrivalTime: new Date(Date.parse(exception.start_time!.value) + duration!.ms),
                pathLength,
                mechanicalEnergyConsumed,
                duration,
              }
            : {
                isValid: false,
              }),
        });
      });

      const sortedOccurrences = sortBy(computedOccurrences, 'startTime');
      setOccurrences(sortedOccurrences);
    };

    buildOccurrences();
  }, [pacedTrain]);

  return { occurrencesCount: occurrenceCountLabel, occurrences };
};

export default useOccurrences;
