import { useState } from 'react';

import { Alert, ArrowSwitch, CheckBox, Download, Filter, Note, Plus } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type { TimetableItem, TimetableItemId } from 'reducers/osrdconf/types';

import FilterPanel from './FilterPanel';
import SelectionToolBar from './TimetableSelectionToolbar';
import type { TimetableFilters } from './types';
import { exportTimetableItems, timetableHasInvalidItem } from './utils';
import { MANAGE_TIMETABLE_ITEM_TYPES } from '../../consts';
import RoundTripsModal from '../RoundTrips/RoundTripsModal';

type TimetableToolbarProps = {
  timetableFilters: TimetableFilters;
  timetableItems: TimetableItem[];
  filteredTimetableItems: TimetableItemWithDetails[];
  selectedTimetableItemIds: TimetableItemId[];
  showTrainDetails: boolean;
  isSelectMode: boolean;
  setSelectedTimetableItemIds: (selectedTimetableItemIds: TimetableItemId[]) => void;
  setShowTrainDetails: (show: boolean) => void;
  setIsSelectMode: (show: boolean) => void;
  setDisplayTimetableItemManagement: (mode: string) => void;
  refreshNge: () => Promise<void>;
  handleDeleteTimetableItems: () => void;
};

const TimetableToolbar = ({
  timetableFilters,
  timetableItems,
  filteredTimetableItems,
  selectedTimetableItemIds,
  showTrainDetails,
  isSelectMode,
  setShowTrainDetails,
  setIsSelectMode,
  setSelectedTimetableItemIds,
  setDisplayTimetableItemManagement,
  refreshNge,
  handleDeleteTimetableItems,
}: TimetableToolbarProps) => {
  const { t } = useTranslation(['operational-studies', 'translation'], { keyPrefix: 'main' });

  const { infraId, timetableId } = useScenarioContext();

  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [roundTripsModalIsOpen, setRoundTripsModalIsOpen] = useState(false);

  const toggleisSelectMode = () => {
    setIsSelectMode(!isSelectMode);
  };

  const toggleShowTrainDetails = () => {
    setShowTrainDetails(!showTrainDetails);
  };

  const toggleFilterPanel = () => {
    setIsFilterPanelOpen(!isFilterPanelOpen);
  };

  const handleExportTimetableItems = () => {
    exportTimetableItems(selectedTimetableItemIds, timetableItems);
  };

  const areAllItemsSelected = selectedTimetableItemIds.length === filteredTimetableItems.length;

  const areInvalidItems = timetableHasInvalidItem(filteredTimetableItems);

  const toggleAllTrainsSelection = () => {
    if (!areAllItemsSelected) {
      const timetableItemsDisplayed = filteredTimetableItems.map(({ id }) => id);
      setSelectedTimetableItemIds(timetableItemsDisplayed);
    } else {
      setSelectedTimetableItemIds([]);
    }
  };

  return (
    <>
      {areInvalidItems && (
        <div className="invalid-trains">
          <Alert size="sm" variant="fill" />
          <span data-testid="invalid-timetable-item-message" className="invalid-trains-message">
            {t('timetable.invalidTrains')}
          </span>
        </div>
      )}
      <div
        className={cx('timetable-toolbar', {
          'are-invalid-items': areInvalidItems,
        })}
      >
        <button
          className={`select-options-button ${isSelectMode ? 'active' : ''}`}
          data-testid="scenarios-select-options-button"
          title={t('timetable.selectOptions')}
          onClick={toggleisSelectMode}
          disabled={timetableItems.length === 0}
          type="button"
        >
          <CheckBox />
        </button>
        <button
          className={`train-detail-button ${showTrainDetails ? 'active' : ''}`}
          data-testid="scenarios-show-train-details-button"
          title={showTrainDetails ? t('lessDetails') : t('moreDetails')}
          onClick={toggleShowTrainDetails}
          disabled={timetableItems.length === 0}
          type="button"
        >
          <Note />
        </button>
        <button
          className="round-trip-button"
          data-testid="scenarios-manage-round-trips-button"
          title={t('roundTripsModal.manageRoundTrips')}
          onClick={() => setRoundTripsModalIsOpen(true)}
          disabled={timetableItems.length === 0}
          type="button"
        >
          <ArrowSwitch />
        </button>
        <button
          className={`filter-button ${isFilterPanelOpen ? 'active' : ''}`}
          data-testid="timetable-filter-button"
          title={t('timetable.toggleFilters')}
          onClick={toggleFilterPanel}
          disabled={timetableItems.length === 0}
          type="button"
        >
          <Filter />
        </button>
        <button
          className="import-button"
          data-testid="scenarios-import-timetable-item-button"
          title={t('timetable.importTimetableItem')}
          onClick={() => setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.import)}
          type="button"
        >
          <Download />
        </button>
        <button
          className="add-button"
          data-testid="scenarios-add-timetable-item-button"
          title={t('timetable.addTimetableItem')}
          onClick={() => setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.add)}
          type="button"
        >
          <Plus />
        </button>
      </div>
      {isSelectMode && filteredTimetableItems.length > 0 && (
        <SelectionToolBar
          selectedTimetableItemIds={selectedTimetableItemIds}
          areAllItemsSelected={areAllItemsSelected}
          areInvalidItems={areInvalidItems}
          toggleAllTrainsSelection={toggleAllTrainsSelection}
          handleExportTimetableItems={handleExportTimetableItems}
          handleDeleteTimetableItems={handleDeleteTimetableItems}
        />
      )}
      {isFilterPanelOpen && (
        <div
          className={cx('sticky-filter', {
            'are-invalid-items': areInvalidItems,
            'selection-mode-open': isSelectMode,
          })}
        >
          <FilterPanel toggleFilterPanel={toggleFilterPanel} timetableFilters={timetableFilters} />
        </div>
      )}
      {roundTripsModalIsOpen && (
        <RoundTripsModal
          roundTripsModalIsOpen={roundTripsModalIsOpen}
          setRoundTripsModalIsOpen={setRoundTripsModalIsOpen}
          infraId={infraId}
          timetableId={timetableId}
          timetableItems={timetableItems}
          refreshNge={refreshNge}
        />
      )}
    </>
  );
};

export default TimetableToolbar;
