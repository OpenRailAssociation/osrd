import { useCallback, useMemo, useState } from 'react';

import { uniq } from 'lodash';

import { useRollingStockContext } from 'common/RollingStockContext';
import isMainCategory from 'modules/rollingStock/helpers/category';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import { useDebounce } from 'utils/helpers';
import { isPacedTrainWithDetails } from 'utils/trainId';

import type {
  TimetableFilters,
  ValidityFilter,
  ScheduledPointsHonoredFilter,
  TrainTypeFilter,
  TrainCategoryFilter,
} from './types';
import { extractTagCode, keepItem } from './utils';

/**
 * Hook filtering a timetable items array depending on some filters
 * @param timetableItems the timetable's items
 * @returns all filters, their setters, the unique speed limit tags among all items and the filtered timetable items
 */
const useFilterTimetableItems = (
  timetableItems: TimetableItemWithDetails[]
): TimetableFilters & { filteredTimetableItems: TimetableItemWithDetails[] } => {
  const [nameLabelFilter, setNameLabelFilter] = useState('');
  const [rollingStockFilter, setRollingStockFilter] = useState('');
  const [validityFilter, setValidityFilter] = useState<ValidityFilter>('both');
  const [scheduledPointsHonoredFilter, setScheduledPointsHonoredFilter] =
    useState<ScheduledPointsHonoredFilter>('both');
  const [trainTypeFilter, setTrainTypeFilter] = useState<TrainTypeFilter>('both');
  const [selectedTags, setSelectedTags] = useState<Set<string | null>>(new Set());
  const [trainCategoryFilter, setTrainCategoryFilter] = useState<TrainCategoryFilter>('all');

  const debouncedNameLabelFilter = useDebounce(nameLabelFilter, 500);
  const debouncedRollingstockFilter = useDebounce(rollingStockFilter, 500);

  const { rollingStocks } = useRollingStockContext();

  const uniqueTags = useMemo(
    () =>
      uniq(
        timetableItems.reduce<string[]>((acc, timetableItem) => {
          if (isPacedTrainWithDetails(timetableItem)) {
            timetableItem.exceptions.forEach((exception) => {
              if (exception.speed_limit_tag) {
                acc.push(extractTagCode(exception.speed_limit_tag.value));
              }
            });
          }
          acc.push(extractTagCode(timetableItem.speedLimitTag));
          return acc;
        }, [])
      ),
    [timetableItems]
  );

  const filterTimetableItem = useCallback(
    ({
      summary,
      name,
      labels,
      speedLimitTag,
      rollingStock,
      category,
    }: Pick<
      TimetableItemWithDetails,
      'name' | 'labels' | 'summary' | 'speedLimitTag' | 'rollingStock' | 'category'
    >) => {
      if (!keepItem(name, labels, debouncedNameLabelFilter)) {
        return false;
      }

      // Apply validity filter
      if (validityFilter !== 'both') {
        if (!summary) return false;
        if (validityFilter === 'valid' && !summary.isValid) return false;
        if (validityFilter === 'invalid' && summary.isValid) return false;
      }

      // Apply scheduled points honored filter
      if (scheduledPointsHonoredFilter !== 'both') {
        if (!summary || !summary.isValid) {
          return false;
        }
        const { notHonoredReason } = summary;
        if (
          (scheduledPointsHonoredFilter === 'honored' && !!notHonoredReason) ||
          (scheduledPointsHonoredFilter === 'notHonored' && !notHonoredReason)
        ) {
          return false;
        }
      }

      // Apply tag filter
      if (selectedTags.size > 0) {
        if (!selectedTags.has(extractTagCode(speedLimitTag))) {
          return false;
        }
      }

      // Apply rolling stock filter
      if (debouncedRollingstockFilter) {
        if (!rollingStock?.metadata) return false;
        const { metadata } = rollingStock;
        if (
          ![
            metadata.detail,
            metadata.family,
            metadata.reference,
            metadata.series,
            metadata.subseries,
          ].some((v) => v.toLowerCase().includes(debouncedRollingstockFilter.toLowerCase()))
        ) {
          return false;
        }
      }

      // Apply train category filter
      if (trainCategoryFilter !== 'all') {
        if (trainCategoryFilter === 'noCategory') {
          if (category) return false;
        } else {
          if (!category) return false;

          if (isMainCategory(category)) {
            if (category.main_category !== trainCategoryFilter) return false;
          } else {
            if (category.sub_category_code !== trainCategoryFilter) return false;
          }
        }
      }

      return true;
    },
    [
      debouncedNameLabelFilter,
      debouncedRollingstockFilter,
      validityFilter,
      scheduledPointsHonoredFilter,
      trainTypeFilter,
      selectedTags,
      trainCategoryFilter,
    ]
  );

  const filteredTimetableItems: TimetableItemWithDetails[] = useMemo(
    () =>
      timetableItems.filter((timetableItem) => {
        if (!isPacedTrainWithDetails(timetableItem)) {
          if (trainTypeFilter === 'pacedTrain') return false;
          return filterTimetableItem(timetableItem);
        }

        if (trainTypeFilter === 'trainSchedule') return false;

        const { exceptions, paced: _, ...modelTrain } = timetableItem;
        const exceptionItems = exceptions.map((exception) => {
          const rollingStock = exception.rolling_stock
            ? rollingStocks?.find((rs) => rs.name === exception.rolling_stock?.rolling_stock_name)
            : undefined;
          return {
            name: exception.train_name?.value ?? modelTrain.name,
            category: exception.rolling_stock_category
              ? exception.rolling_stock_category.value
              : modelTrain.category,
            labels: exception.labels?.value ?? [],
            speedLimitTag: exception.speed_limit_tag
              ? (exception.speed_limit_tag.value ?? null)
              : modelTrain.speedLimitTag,
            rollingStock,
            summary: exception.summary,
          };
        });
        return [modelTrain, ...exceptionItems].some((item) => filterTimetableItem(item));
      }),
    [timetableItems, filterTimetableItem]
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
    trainCategoryFilter,
    setTrainCategoryFilter,
  };
};

export default useFilterTimetableItems;
