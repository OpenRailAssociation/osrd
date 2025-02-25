import { useMemo, useState } from 'react';

import { uniq } from 'lodash';

import { useDebounce } from 'utils/helpers';
import { isPacedTrain, isTrainSchedule } from 'utils/trainId';

import type {
  ScheduledPointsHonoredFilter,
  TimetableFilters,
  TimetableItemResult,
  TrainTypeFilter,
  ValidityFilter,
} from './types';
import { extractTagCode, keepItem } from './utils';

/**
 * Hook filtering a timetable items array depending on some filters
 * @param timetableItems the timetable's items
 * @returns all filters, their setters, the unique speed limit tags among all items and the filtered timetable items
 */
const useFilterTimetableItems = (
  timetableItems: TimetableItemResult[]
): TimetableFilters & { filteredTimetableItems: TimetableItemResult[] } => {
  const [nameLabelFilter, setNameLabelFilter] = useState('');
  const [rollingStockFilter, setRollingStockFilter] = useState('');
  const [validityFilter, setValidityFilter] = useState<ValidityFilter>('both');
  const [scheduledPointsHonoredFilter, setScheduledPointsHonoredFilter] =
    useState<ScheduledPointsHonoredFilter>('both');
  const [trainTypeFilter, setTrainTypeFilter] = useState<TrainTypeFilter>('both');
  const [selectedTags, setSelectedTags] = useState<Set<string | null>>(new Set());

  const debouncedNameLabelFilter = useDebounce(nameLabelFilter, 500);
  const debouncedRollingstockFilter = useDebounce(rollingStockFilter, 500);

  const uniqueTags = useMemo(
    () => uniq(timetableItems.map((timetableItem) => extractTagCode(timetableItem.speedLimitTag))),
    [timetableItems]
  );

  const filteredTimetableItems: TimetableItemResult[] = useMemo(
    () =>
      timetableItems.filter((timetableItem) => {
        if (!keepItem(timetableItem, debouncedNameLabelFilter)) return false;

        // Apply validity filter
        if (validityFilter !== 'both') {
          if (validityFilter === 'valid' && !timetableItem.isValid) return false;
          if (validityFilter === 'invalid' && timetableItem.isValid) return false;
        }

        // Apply scheduled points honored filter
        if (scheduledPointsHonoredFilter !== 'both') {
          if (!timetableItem.isValid) {
            return false;
          }
          const { scheduledPointsNotHonored } = timetableItem;
          if (
            (scheduledPointsHonoredFilter === 'honored' && scheduledPointsNotHonored) ||
            (scheduledPointsHonoredFilter === 'notHonored' && !scheduledPointsNotHonored)
          ) {
            return false;
          }
        }

        // Apply train type filter
        if (trainTypeFilter !== 'both') {
          if (trainTypeFilter === 'pacedTrain' && isTrainSchedule(timetableItem.id)) return false;
          if (trainTypeFilter === 'trainSchedule' && isPacedTrain(timetableItem.id)) return false;
        }

        // Apply tag filter
        if (
          selectedTags.size > 0 &&
          !selectedTags.has(extractTagCode(timetableItem.speedLimitTag))
        ) {
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
          } = timetableItem.rollingStock?.metadata || {};
          if (
            ![detail, family, reference, series, subseries].some((v) =>
              v.toLowerCase().includes(debouncedRollingstockFilter.toLowerCase())
            )
          )
            return false;
        }

        return true;
      }),
    [
      timetableItems,
      debouncedNameLabelFilter,
      debouncedRollingstockFilter,
      validityFilter,
      scheduledPointsHonoredFilter,
      trainTypeFilter,
      selectedTags,
    ]
  );

  return {
    filteredTimetableItems,
    uniqueTags,
    nameLabelFilter,
    setNameLabelFilter,
    rollingStockFilter,
    setRollingStockFilter,
    validityFilter,
    setValidityFilter,
    scheduledPointsHonoredFilter,
    setScheduledPointsHonoredFilter,
    trainTypeFilter,
    setTrainTypeFilter,
    selectedTags,
    setSelectedTags,
  };
};

export default useFilterTimetableItems;
