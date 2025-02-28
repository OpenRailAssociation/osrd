import { Input, Select } from '@osrd-project/ui-core';
import { X } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type {
  ValidityFilter,
  ScheduledPointsHonoredFilter,
  TimetableFilters,
  TrainTypeFilter,
} from './types';

type FilterPanelProps = {
  toggleFilterPanel: () => void;
  timetableFilters: TimetableFilters;
};

const FilterPanel = ({ toggleFilterPanel, timetableFilters }: FilterPanelProps) => {
  const { t } = useTranslation('operationalStudies/scenario');

  const {
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
    uniqueTags,
    selectedTags,
    setSelectedTags,
  } = timetableFilters;

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

  const trainTypeOptions: { value: TrainTypeFilter; label: string }[] = [
    { value: 'both', label: t('timetable.showAllTrains') },
    { value: 'pacedTrain', label: t('timetable.pacedTrain') },
    { value: 'trainSchedule', label: t('timetable.trainSchedule') },
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
            narrow
            small
            value={nameLabelFilter}
            onChange={(e) => setNameLabelFilter(e.target.value)}
            placeholder={t('filterPlaceholder')}
            data-testid="timetable-label-filter"
            title={t('filterPlaceholder')}
          />

          <Select
            getOptionLabel={(option) => option.label}
            getOptionValue={(option) => option.value}
            id="timetable-train-validity-filter"
            label={t('timetable.validityFilter')}
            narrow
            small
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
          <Select
            getOptionLabel={(option) => option.label}
            getOptionValue={(option) => option.value}
            id="timetable-train-type-filter"
            label={t('timetable.trainType')}
            narrow
            small
            onChange={(selectedOption) => {
              if (selectedOption) {
                setTrainTypeFilter(selectedOption.value);
              }
            }}
            options={trainTypeOptions}
            value={
              trainTypeOptions.find((option) => option.value === trainTypeFilter) ||
              trainTypeOptions[0]
            }
          />
        </div>
        <div id="schedule-point-honored-and-rollingstock">
          <Input
            type="text"
            id="timetable-rollingstock-filter"
            name="timetable-rollingstock-filter"
            label={t('timetable.advancedFilterLabel')}
            narrow
            small
            value={rollingStockFilter}
            onChange={(e) => setRollingStockFilter(e.target.value)}
            placeholder={t('timetable.rollingStockFilterPlaceholder')}
            data-testid="timetable-rollingstock-filter"
            title={t('timetable.rollingStockFilterPlaceholder')}
          />

          <Select
            getOptionLabel={(option) => option.label}
            getOptionValue={(option) => option.value}
            id="timetable-train-punctuality-filter"
            label={t('timetable.punctuality')}
            narrow
            small
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
      <div className="speed-limit-tag">
        <label htmlFor="timetable-speed-limit-tag-filter">{t('timetable.speedLimitTags')}</label>
        <div className="speed-limit-tag-filter" id="timetable-speed-limit-tag-filter">
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
