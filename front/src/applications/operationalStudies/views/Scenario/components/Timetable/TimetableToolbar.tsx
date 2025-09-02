import { useState } from 'react';

import { Alert, Filter } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type { TimetableItem } from 'reducers/osrdconf/types';

import FilterPanel from './FilterPanel';
import type { TimetableFilters } from './types';
import { timetableHasInvalidItem } from './utils';

type TimetableToolbarProps = {
  filteredTimetableItems: TimetableItemWithDetails[];
  timetableFilters: TimetableFilters;
  timetableItems: TimetableItem[];
  isInSelection: boolean;
};

const TimetableToolbar = ({
  filteredTimetableItems,
  timetableFilters,
  timetableItems,
  isInSelection,
}: TimetableToolbarProps) => {
  const { t } = useTranslation(['operational-studies', 'translation'], { keyPrefix: 'main' });

  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const toggleFilterPanel = () => {
    setIsFilterPanelOpen(!isFilterPanelOpen);
  };

  return (
    <>
      {timetableHasInvalidItem(filteredTimetableItems) && (
        <div className="invalid-trains">
          <Alert size="sm" variant="fill" />
          <span data-testid="invalid-timetable-item-message" className="invalid-trains-message">
            {t('timetable.invalidTrains')}
          </span>
        </div>
      )}
      {timetableItems.length > 0 && (
        <div
          className={cx('sticky-filter', {
            'selection-mode-open': isInSelection,
          })}
        >
          {!isFilterPanelOpen ? (
            <div className="filter">
              <button
                data-testid="timetable-filter-button"
                aria-label={t('timetable.toggleFilters')}
                onClick={toggleFilterPanel}
                type="button"
                className="filter-button"
              >
                <Filter />
              </button>
            </div>
          ) : (
            <FilterPanel
              toggleFilterPanel={toggleFilterPanel}
              timetableFilters={timetableFilters}
            />
          )}
        </div>
      )}
    </>
  );
};

export default TimetableToolbar;
