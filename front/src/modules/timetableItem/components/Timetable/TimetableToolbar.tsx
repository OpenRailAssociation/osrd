import { useState } from 'react';

import { Alert, ArrowSwitch, Filter } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { TimetableItem } from 'reducers/osrdconf/types';

import FilterPanel from './FilterPanel';
import RoundTripsModal from './RoundTrips/RoundTripsModal';
import type { TimetableFilters, TimetableItemWithDetails } from './types';
import { timetableHasInvalidItem } from './utils';

type TimetableToolbarProps = {
  showTrainDetails: boolean;
  toggleShowTrainDetails: () => void;
  filteredTimetableItems: TimetableItemWithDetails[];
  timetableFilters: TimetableFilters;
  timetableItems: TimetableItem[];
  isInSelection: boolean;
};

const TimetableToolbar = ({
  showTrainDetails,
  toggleShowTrainDetails,
  filteredTimetableItems,
  timetableFilters,
  timetableItems,
  isInSelection,
}: TimetableToolbarProps) => {
  const { t } = useTranslation(['operational-studies', 'translation'], { keyPrefix: 'main' });
  const { infraId } = useScenarioContext();

  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [roundTripsModalIsOpen, setRoundTripsModalIsOpen] = useState(false);

  const toggleFilterPanel = () => {
    setIsFilterPanelOpen(!isFilterPanelOpen);
  };

  return (
    <>
      <div
        className={cx('scenario-timetable-toolbar', {
          centered: timetableItems.length === 0,
        })}
      >
        <div
          className={cx('toolbar-header', {
            'with-details': isInSelection,
          })}
        >
          {timetableItems.length > 0 && (
            <div>
              <button
                type="button"
                className="more-details-button"
                onClick={toggleShowTrainDetails}
                title={t('displayTrainsWithDetails')}
              >
                {showTrainDetails ? t('lessDetails') : t('moreDetails')}
              </button>
            </div>
          )}
          <button
            type="button"
            title={t('roundTripsModal.manageRoundTrips')}
            onClick={() => setRoundTripsModalIsOpen(true)}
          >
            <ArrowSwitch />
          </button>
          {roundTripsModalIsOpen && (
            <RoundTripsModal
              roundTripsModalIsOpen={roundTripsModalIsOpen}
              setRoundTripsModalIsOpen={setRoundTripsModalIsOpen}
              infraId={infraId}
              timetableItems={timetableItems}
            />
          )}
        </div>
      </div>
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
