import { useMemo } from 'react';

import { omit, sortBy } from 'lodash';

import { generateBareOccurrences } from 'applications/operationalStudies/helpers/generateBareOccurrences';
import { intermediateStopsCount } from 'applications/operationalStudies/utils';
import { type LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/trainSchedule/helpers/computeOccurrenceName';
import type {
  Occurrence,
  PacedTrainWithDetails,
  SimulatedException,
} from 'modules/trainSchedule/types';
import { isIndexedOccurrenceId, extractOccurrenceIndexFromOccurrenceId } from 'utils/trainId';

export const returnOccurrenceExceptionRollingStock = ({
  exception,
  rollingStock,
  rollingStockList,
}: {
  exception: SimulatedException | undefined;
  rollingStock: LightRollingStockWithLiveries | undefined;
  rollingStockList: LightRollingStockWithLiveries[] | null;
}) => {
  let occurrenceRollingStock = rollingStock;
  if (exception?.rolling_stock && rollingStockList) {
    const rollingStockName = exception.rolling_stock.rolling_stock_name;
    occurrenceRollingStock = rollingStockList.find((rs) => rs.name === rollingStockName);
  }
  return occurrenceRollingStock;
};

/**
 * This hook computes the occurrences of a paced train based on its exceptions and the number of occurrences defined by the paced train
 * interval and time window. It also enriches the occurrences with the corresponding exception data when it exists (e.g. disabled, rolling
 * stock change, start time change...).
 *
 * @param pacedTrain the paced train with details
 * @param rollingStockList the list of rolling stock with their liveries, used to enrich the occurrence rolling stock when there is a change
 * defined in the exception
 * @returns the occurrences of the paced train with their details and the count of occurrences (taking into account the disabled exceptions)
 */
const useOccurrences = (
  pacedTrain: PacedTrainWithDetails,
  rollingStockList: LightRollingStockWithLiveries[] | null
): { occurrencesCount: number; occurrences: Occurrence[] } => {
  const {
    paced,
    name,
    rollingStock,
    stopsCount,
    summary,
    category: pacedTrainCategory,
  } = pacedTrain;
  const { exceptions } = paced;

  const occurrences = useMemo(() => {
    const computedOccurrences = generateBareOccurrences(pacedTrain).map(
      ({ id, startTime, exception }): Occurrence => {
        let occurrenceIndex: number | undefined;
        let trainName = exception?.train_name?.value;
        if (isIndexedOccurrenceId(id)) {
          occurrenceIndex = extractOccurrenceIndexFromOccurrenceId(id);
          trainName ??= computeOccurrenceName(name, occurrenceIndex);
        } else {
          trainName ??= `${name}/+`;
        }

        return {
          id,
          startTime,
          trainName,
          occurrenceIndex,
          rollingStock: returnOccurrenceExceptionRollingStock({
            exception,
            rollingStock,
            rollingStockList,
          }),
          stopsCount: exception?.path_and_schedule
            ? intermediateStopsCount(exception.path_and_schedule)
            : stopsCount,
          disabled: exception?.disabled ?? false,
          category: exception?.rolling_stock_category
            ? exception.rolling_stock_category.value
            : pacedTrainCategory,
          summary: exception?.summary ?? summary,
          exception: exception
            ? {
                // TODO_EXCEPTION: remove `!` when use TrainScheduleException type
                id: exception.id!,
                exceptionChangeGroups: omit(exception, [
                  // TODO_EXCEPTION: remove 'key' when use TrainScheduleException type
                  'key',
                  'occurrence_index',
                  'disabled',
                  'summary',
                  'id',
                ]),
              }
            : undefined,
        };
      }
    );

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
