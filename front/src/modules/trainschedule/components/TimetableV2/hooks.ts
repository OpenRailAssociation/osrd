import { useEffect } from 'react';

import dayjs from 'dayjs';

import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import type { SimulationSummaryResult, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import { isoDateToMs, msToIsoDate } from 'utils/date';
import { jouleToKwh } from 'utils/physics';
import { formatKmValue } from 'utils/strings';

import type { TrainScheduleWithDetails } from './types';
import { extractTagCode, keepTrain } from './utils';

/**
 * Hook formatting a sorted train schedules array for timetable train cards depending on filtering
 * @param trainIds the timetable's train ids
 * @param debouncedFilter filter for train name and labels
 * @param debouncedRollingstockFilter filter for train's rolling stock metadata
 * @param validityFilter filter for valid train or not
 * @param selectedTags filter for train's speed limit tag
 */
const useTrainSchedulesDetails = (
  trainIds: number[],
  setTrainSchedulesDetails: (trainSchedulesDetails: TrainScheduleWithDetails[]) => void,
  debouncedFilter: string,
  debouncedRollingstockFilter: string,
  validityFilter: string,
  selectedTags: Set<string | null>
) => {
  const infraId = useInfraID();

  // TODO : both endpoints are fired because of the provided tags when a train is added or deleted,
  // resulting in an useless call when trainIds has not changed yet.
  // This happens even if we use lazyQuery here, we should investigate why.
  const { currentData: trainSchedulesSummary } =
    enhancedEditoastApi.endpoints.getV2TrainScheduleSimulationSummary.useQuery(
      {
        infra: infraId as number,
        ids: trainIds,
      },
      { skip: !infraId || !trainIds.length }
    );

  const { currentData: trainSchedules } = enhancedEditoastApi.endpoints.getV2TrainSchedule.useQuery(
    {
      ids: trainIds,
    },
    {
      skip: !trainIds.length,
    }
  );

  // We fetch all RS to get the data we need for the advanced filters
  const { data: { results: rollingStocks } = { results: [] } } =
    enhancedEditoastApi.endpoints.getLightRollingStock.useQuery({ pageSize: 1000 });

  useEffect(() => {
    const filterTrainSchedules = (
      _trainSchedules: TrainScheduleResult[],
      _trainSchedulesSummary: { [key: string]: SimulationSummaryResult }
    ) =>
      _trainSchedules.filter((trainSchedule) => {
        if (!keepTrain(trainSchedule, debouncedFilter)) return false;

        const trainSummary = _trainSchedulesSummary[trainSchedule.id];

        // Apply validity filter
        if (validityFilter !== 'both') {
          if (validityFilter === 'valid' && trainSummary.status !== 'success') return false;
          if (validityFilter === 'invalid' && trainSummary.status === 'success') return false;
        }

        // Apply tag filter
        if (
          trainSchedule.speed_limit_tag &&
          selectedTags.size > 0 &&
          !selectedTags.has(extractTagCode(trainSchedule.speed_limit_tag))
        )
          return false;

        // Apply rolling stock filter
        if (debouncedRollingstockFilter) {
          const rollingStock = rollingStocks.find(
            (rs) => rs.name === trainSchedule.rolling_stock_name
          );
          const {
            detail = '',
            family = '',
            reference = '',
            series = '',
            subseries = '',
          } = rollingStock?.metadata || {};
          if (
            ![detail, family, reference, series, subseries].some((v) =>
              v.toLowerCase().includes(debouncedRollingstockFilter.toLowerCase())
            )
          )
            return false;
        }

        return true;
      });

    if (trainIds.length === 0) {
      setTrainSchedulesDetails([]);
      return;
    }

    if (trainSchedulesSummary && trainSchedules) {
      // We want to trigger this only if a filter is applied
      const filtereredTrainSchedules =
        validityFilter !== 'both' ||
        selectedTags.size > 0 ||
        debouncedRollingstockFilter ||
        debouncedFilter
          ? filterTrainSchedules(trainSchedules, trainSchedulesSummary)
          : trainSchedules;

      const formatedTrains: TrainScheduleWithDetails[] = [...filtereredTrainSchedules]
        .sort(
          (trainA, trainB) =>
            new Date(trainA.start_time).valueOf() - new Date(trainB.start_time).valueOf()
        )
        .map((trainSchedule) => {
          const rollingStock = rollingStocks.find(
            (rs) => rs.name === trainSchedule.rolling_stock_name
          );
          const trainSummary = trainSchedulesSummary[trainSchedule.id];
          const formattedStartTimeMs = isoDateToMs(trainSchedule.start_time);

          const otherProps =
            trainSummary.status === 'success'
              ? {
                  arrivalTime: msToIsoDate(formattedStartTimeMs + trainSummary.time, true),
                  duration: trainSummary.time,
                  pathLength: formatKmValue(trainSummary.length, 'millimeters', 1),
                  mechanicalEnergyConsumed: jouleToKwh(trainSummary.energy_consumption, true),
                }
              : {
                  arrivalTime: '',
                  duration: 0,
                  pathLength: '',
                  mechanicalEnergyConsumed: 0,
                  invalidReason: trainSummary.status,
                };

          return {
            id: trainSchedule.id,
            trainName: trainSchedule.train_name,
            startTime: dayjs(trainSchedule.start_time).format('D/MM/YYYY HH:mm:ss'), // format to time
            stepsCount: trainSchedule.schedule?.length ?? 0,
            speedLimitTag: trainSchedule.speed_limit_tag ?? null,
            labels: trainSchedule.labels ?? [],
            rollingStock,
            ...otherProps,
          };
        });
      setTrainSchedulesDetails(formatedTrains);
    }
  }, [
    trainIds,
    trainSchedulesSummary,
    trainSchedules,
    debouncedFilter,
    debouncedRollingstockFilter,
    validityFilter,
    selectedTags,
  ]);
};

export default useTrainSchedulesDetails;
