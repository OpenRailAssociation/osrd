import { Input, Select } from '@osrd-project/ui-core';
import { X } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { ValidityFilter, ScheduledPointsHonoredFilter } from './types';

type FilterPanelProps = {
  toggleFilterPanel: () => void;
  filter: string;
  setFilter: (filter: string) => void;
  rollingStockFilter: string;
  setRollingStockFilter: (rollingStockFilter: string) => void;
  validityFilter: ValidityFilter;
  setValidityFilter: (validityFilter: ValidityFilter) => void;
  scheduledPointsHonoredFilter: ScheduledPointsHonoredFilter;
  setScheduledPointsHonoredFilter: (
    scheduledPointsHonoredFilter: ScheduledPointsHonoredFilter
  ) => void;
  uniqueTags: string[];
  selectedTags: Set<string | null>;
  setSelectedTags: React.Dispatch<React.SetStateAction<Set<string | null>>>;
};

const FilterPanel = ({
  toggleFilterPanel,
  filter,
  setFilter,
  rollingStockFilter,
  setRollingStockFilter,
  validityFilter,
  setValidityFilter,
  scheduledPointsHonoredFilter,
  setScheduledPointsHonoredFilter,
  uniqueTags,
  selectedTags,
  setSelectedTags,
}: FilterPanelProps) => {
  const { t } = useTranslation('operationalStudies/scenario');

  const validityOptions: { value: ValidityFilter; label: string }[] = [
    { value: 'both', label: t('timetable.showAllTrains') },
    { value: 'valid', label: t('timetable.showValidTrains') },
    { value: 'invalid', label: t('timetable.showInvalidTrains') },
  ];

  const scheduledPointsHonoredOptions: { value: ScheduledPointsHonoredFilter; label: string }[] = [
    { value: 'both', label: t('timetable.showAllTrains') },
    { value: 'honored', label: t('timetable.showHonoredTrains') },
    { value: 'notHonored', label: t('timetable.showNotHonoredTrains') },
  ];

  const toggleTagSelection = (tag: string | null) => {
    setSelectedTags((prevSelectedTags) => {
      const newSelectedTags = new Set(prevSelectedTags);
      if (newSelectedTags.has(tag)) {
        newSelectedTags.delete(tag);
      } else {
        newSelectedTags.add(tag);
      }
      return newSelectedTags;
    });
  };

  return (
    <div className="filter-panel">
      <button
        data-testid="timetable-filter-button-close"
        aria-label={t('timetable.closeFilter')}
        onClick={toggleFilterPanel}
        type="button"
        className="close-filter"
      >
        <X iconColor="#B6B2AF" />
      </button>
      <div className="grid-template">
        <div id="train-validity-and-label">
          <Input
            type="text"
            id="timetable-label-filter"
            name="timetable-label-filter"
            label={t('timetable.filterLabel')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('filterPlaceholder')}
            data-testid="timetable-label-filter"
            title={t('filterPlaceholder')}
          />

          <Select
            getOptionLabel={(option) => option.label}
            getOptionValue={(option) => option.value}
            id="train-validity"
            label={t('timetable.validityFilter')}
            onChange={(selectedOption) => {
              if (selectedOption) {
                setValidityFilter(selectedOption.value);
              }
            }}
            options={validityOptions}
            value={
              validityOptions.find((option) => option.value === validityFilter) ||
              validityOptions[0]
            }
          />
        </div>

        <div id="schedule-point-honored-and-rollingstock">
          <Input
            type="text"
            id="timetable-rollingstock-filter"
            name="timetable-rollingstock-filter"
            label={t('timetable.advancedFilterLabel')}
            value={rollingStockFilter}
            onChange={(e) => setRollingStockFilter(e.target.value)}
            placeholder={t('timetable.rollingStockFilterPlaceholder')}
            data-testid="timetable-rollingstock-filter"
            title={t('timetable.rollingStockFilterPlaceholder')}
          />

          <Select
            getOptionLabel={(option) => option.label}
            getOptionValue={(option) => option.value}
            id="train-keep-timetable"
            label={t('timetable.punctuality')}
            onChange={(selectedOption) => {
              if (selectedOption) {
                setScheduledPointsHonoredFilter(selectedOption.value);
              }
            }}
            options={scheduledPointsHonoredOptions}
            value={
              scheduledPointsHonoredOptions.find(
                (option) => option.value === scheduledPointsHonoredFilter
              ) || scheduledPointsHonoredOptions[0]
            }
          />
        </div>
      </div>
      <div className="compositions-code">
        <label htmlFor="composition-tag-filter">{t('timetable.compositionCodes')}</label>
        <div className="composition-tag-filter" id="composition-tag-filter">
          {uniqueTags.map((tag) => {
            const displayTag = tag !== 'NO CODE' ? tag : t('timetable.noSpeedLimitTagsShort');
            return (
              <button
                className={cx('btn', 'btn-sm', { selectedTag: selectedTags.has(tag) })}
                type="button"
                key={tag}
                onClick={() => toggleTagSelection(tag)}
              >
                {displayTag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
