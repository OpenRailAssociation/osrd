import { useEffect, useState } from 'react';

import { uniq } from 'lodash';

import type { ScheduledPointsHonoredFilter, TimetableItemResult, ValidityFilter } from './types';
import { extractTagCode, keepTrain } from './utils';

/**
 * Hook filtering a train schedules array for timetable train cards
 * @param trainSchedulesWithDetails the timetable's train schedules
 * @param debouncedFilter filter on train name and labels
 * @param debouncedRollingstockFilter filter on train's rolling stock metadata
 * @param validityFilter filter on valid train or not
 * @param scheduledPointsHonoredFilter filter on trains that keep their timetables or not
 * @param selectedTags filter on train's speed limit tag
 * @returns trainschedules unique speedlimit tags
 */
const useFilterTrainSchedules = (
  timetableItems: TimetableItemResult[],
  debouncedFilter: string,
  debouncedRollingstockFilter: string,
  validityFilter: ValidityFilter,
  scheduledPointsHonoredFilter: ScheduledPointsHonoredFilter,
  selectedTags: Set<string | null>,
  setDisplayedTimetableItems: (trainSchedulesDetails: TimetableItemResult[]) => void
) => {
  const [uniqueTags, setUniqueTags] = useState<string[]>([]);

  const filterTrainSchedules = (trainSchedules: TimetableItemResult[]) =>
    trainSchedules.filter((trainSchedule) => {
      if (!keepTrain(trainSchedule, debouncedFilter)) return false;

      // Apply validity filter
      if (validityFilter !== 'both') {
        if (validityFilter === 'valid' && !trainSchedule.isValid) return false;
        if (validityFilter === 'invalid' && trainSchedule.isValid) return false;
      }

      // Apply scheduled points honored filter
      if (scheduledPointsHonoredFilter !== 'both') {
        if (!trainSchedule.isValid) {
          return false;
        }
        const { scheduledPointsNotHonored } = trainSchedule;
        if (
          (scheduledPointsHonoredFilter === 'honored' && scheduledPointsNotHonored) ||
          (scheduledPointsHonoredFilter === 'notHonored' && !scheduledPointsNotHonored)
        ) {
          return false;
        }
      }

      // Apply tag filter
      if (selectedTags.size > 0 && !selectedTags.has(extractTagCode(trainSchedule.speedLimitTag))) {
        return false;
      }

      // Apply rolling stock filter
      if (debouncedRollingstockFilter) {
        const {
          detail = '',
          family = '',
          reference = '',
          series = '',
          subseries = '',
        } = trainSchedule.rollingStock?.metadata || {};
        if (
          ![detail, family, reference, series, subseries].some((v) =>
            v.toLowerCase().includes(debouncedRollingstockFilter.toLowerCase())
          )
        )
          return false;
      }

      return true;
    });

  useEffect(() => {
    // trigger this only if at least one filter is applied
    const filtereredTrainSchedules =
      validityFilter !== 'both' ||
      scheduledPointsHonoredFilter !== 'both' ||
      selectedTags.size > 0 ||
      debouncedRollingstockFilter ||
      debouncedFilter
        ? filterTrainSchedules(timetableItems)
        : timetableItems;

    setDisplayedTimetableItems(filtereredTrainSchedules);

    setUniqueTags(uniq(timetableItems.map((train) => extractTagCode(train.speedLimitTag))));
  }, [
    timetableItems,
    debouncedFilter,
    debouncedRollingstockFilter,
    validityFilter,
    scheduledPointsHonoredFilter,
    selectedTags,
  ]);

  return { uniqueTags, trainSchedules: timetableItems };
};

export default useFilterTrainSchedules;
