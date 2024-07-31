import { useEffect, useState } from 'react';

import dayjs from 'dayjs';
import { uniq } from 'lodash';
import { useSelector } from 'react-redux';

import type { SimulationSummaryResult, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdConfSelectors } from 'common/osrdContext';
import { formatToIsoDate, isoDateToMs } from 'utils/date';
import { jouleToKwh } from 'utils/physics';
import { formatKmValue } from 'utils/strings';
import { ISO8601Duration2sec } from 'utils/timeManipulation';

import type { TrainScheduleWithDetails } from './types';
import { extractTagCode, keepTrain } from './utils';

/**
 * Hook formatting a sorted train schedules array for timetable train cards depending on filtering
 * @param trainIds the timetable's train ids
 * @param debouncedFilter filter for train name and labels
 * @param debouncedRollingstockFilter filter for train's rolling stock metadata
 * @param validityFilter filter for valid train or not
 * @param scheduledPointsHonoredFilter filter for trains that keep their timetables or not
 * @param selectedTags filter for train's speed limit tag
 * @returns trainschedules unique speedlimit tags and train schedules
 */
const useTrainSchedulesDetails = (
  trainIds: number[],
  setTrainSchedulesDetails: (trainSchedulesDetails: TrainScheduleWithDetails[]) => void,
  debouncedFilter: string,
  debouncedRollingstockFilter: string,
  validityFilter: string,
  scheduledPointsHonoredFilter: string,
  selectedTags: Set<string | null>
) => {
  const infraId = useInfraID();
  const { getElectricalProfileSetId } = useOsrdConfSelectors();
  const electricalProfileSetId = useSelector(getElectricalProfileSetId);

  const [uniqueTags, setUniqueTags] = useState<string[]>([]);

  const { currentData: trainSchedulesSummary } =
    osrdEditoastApi.endpoints.postV2TrainScheduleSimulationSummary.useQuery(
      {
        body: {
          infra_id: infraId as number,
          ids: trainIds,
          electrical_profile_set_id: electricalProfileSetId,
        },
      },
      {
        skip: !infraId || !trainIds.length,
        refetchOnMountOrArgChange: true,
      }
    );

  const { currentData: trainSchedules } = osrdEditoastApi.endpoints.postV2TrainSchedule.useQuery(
    {
      body: {
        ids: trainIds,
      },
    },
    {
      skip: !trainIds.length,
    }
  );

  // We fetch all RS to get the data we need for the advanced filters
  const { data: { results: rollingStocks } = { results: [] } } =
    osrdEditoastApi.endpoints.getLightRollingStock.useQuery({ pageSize: 1000 });

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

        // Apply scheduled points honored filter
        if (scheduledPointsHonoredFilter !== 'both') {
          if (trainSummary.status === 'success') {
            const isHonored = trainSummary.scheduled_points_honored;
            if (
              (scheduledPointsHonoredFilter === 'honored' && !isHonored) ||
              (scheduledPointsHonoredFilter === 'notHonored' && isHonored)
            ) {
              return false;
            }
          } else {
            return false;
          }
        }

        // Apply tag filter
        if (
          selectedTags.size > 0 &&
          !selectedTags.has(extractTagCode(trainSchedule.speed_limit_tag))
        ) {
          return false;
        }

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
      setUniqueTags([]);
      return;
    }

    if (trainSchedulesSummary && trainSchedules) {
      // We want to trigger this only if a filter is applied
      const filtereredTrainSchedules =
        validityFilter !== 'both' ||
        scheduledPointsHonoredFilter !== 'both' ||
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
                  arrivalTime: formatToIsoDate(formattedStartTimeMs + trainSummary.time, true),
                  duration: trainSummary.time,
                  pathLength: formatKmValue(trainSummary.length, 'millimeters', 1),
                  mechanicalEnergyConsumed: jouleToKwh(trainSummary.energy_consumption, true),
                  scheduledPointsNotHonored: !trainSummary.scheduled_points_honored,
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
            stopsCount:
              (trainSchedule.schedule?.filter(
                (step) => step.stop_for && ISO8601Duration2sec(step.stop_for) > 0
              ).length ?? 0) + 1, // +1 to take the final stop (destination) into account
            speedLimitTag: trainSchedule.speed_limit_tag ?? null,
            labels: trainSchedule.labels ?? [],
            rollingStock,

            ...otherProps,
          };
        });

      setUniqueTags(uniq(trainSchedules.map((train) => extractTagCode(train.speed_limit_tag))));
      setTrainSchedulesDetails(formatedTrains);
    }
  }, [
    trainIds,
    trainSchedulesSummary,
    trainSchedules,
    debouncedFilter,
    debouncedRollingstockFilter,
    validityFilter,
    scheduledPointsHonoredFilter,
    selectedTags,
  ]);

  return { uniqueTags, trainSchedules };
};

export default useTrainSchedulesDetails;
