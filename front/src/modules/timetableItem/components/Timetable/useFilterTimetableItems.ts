import { useMemo, useState } from 'react';

import { uniq } from 'lodash';

import { useRollingStockContext } from 'common/RollingStockContext';
import { isMainCategory } from 'modules/rollingStock/helpers/utils';
import { useDebounce } from 'utils/helpers';
import { isPacedTrainId, isPacedTrainWithDetails, isTrainScheduleId } from 'utils/trainId';

import type {
  ScheduledPointsHonoredFilter,
  TimetableFilters,
  TrainTypeFilter,
  TimetableItemWithDetails,
  ValidityFilter,
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

  const filteredTimetableItems: TimetableItemWithDetails[] = useMemo(
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
          if (trainTypeFilter === 'pacedTrain' && isTrainScheduleId(timetableItem.id)) return false;
          if (trainTypeFilter === 'trainSchedule' && isPacedTrainId(timetableItem.id)) return false;
        }

        // Apply tag filter
        if (selectedTags.size > 0) {
          const itemTag = extractTagCode(timetableItem.speedLimitTag);
          const exceptionTags = isPacedTrainWithDetails(timetableItem)
            ? timetableItem.exceptions
                .filter((exception) => exception.speed_limit_tag)
                .map((exception) => extractTagCode(exception.speed_limit_tag!.value))
            : [];
          const allTags = uniq([itemTag, ...exceptionTags]);

          if (!allTags.some((tag) => selectedTags.has(tag))) {
            return false;
          }
        }

        // Apply rolling stock filter
        if (debouncedRollingstockFilter) {
          const rollingStockMetadata = [];
          const {
            detail = '',
            family = '',
            reference = '',
            series = '',
            subseries = '',
          } = timetableItem.rollingStock?.metadata || {};
          rollingStockMetadata.push(detail, family, reference, series, subseries);

          if (isPacedTrainWithDetails(timetableItem)) {
            timetableItem.exceptions.forEach((exception) => {
              if (!exception.rolling_stock) return;
              const exceptionRollingStock = rollingStocks?.find(
                (rollingStock) => rollingStock.name === exception.rolling_stock?.rolling_stock_name
              );
              const {
                detail: _detail = '',
                family: _family = '',
                reference: _reference = '',
                series: _series = '',
                subseries: _subseries = '',
              } = exceptionRollingStock?.metadata || {};
              rollingStockMetadata.push(_detail, _family, _reference, _series, _subseries);
            });
          }

          if (
            !rollingStockMetadata.some((v) =>
              v.toLowerCase().includes(debouncedRollingstockFilter.toLowerCase())
            )
          )
            return false;
        }

        // Apply train category filter
        if (trainCategoryFilter !== 'all') {
          const exceptionsCategories = isPacedTrainWithDetails(timetableItem)
            ? timetableItem.exceptions
                .filter(
                  (exception) =>
                    exception.rolling_stock_category?.value &&
                    isMainCategory(exception.rolling_stock_category.value) &&
                    exception.rolling_stock_category.value.main_category
                )
                .map(
                  (exception) =>
                    exception.rolling_stock_category!.value &&
                    isMainCategory(exception.rolling_stock_category!.value) &&
                    extractTagCode(exception.rolling_stock_category!.value.main_category)
                )
            : [];
          const allCategories = uniq([timetableItem.category, ...exceptionsCategories]);
          if (
            !allCategories.some((category) =>
              trainCategoryFilter === 'noCategory' ? !category : category === trainCategoryFilter
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
      trainCategoryFilter,
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
    trainCategoryFilter,
    setTrainCategoryFilter,
  };
};

export default useFilterTimetableItems;
