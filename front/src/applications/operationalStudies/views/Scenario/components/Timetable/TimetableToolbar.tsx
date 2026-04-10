import { useContext, useState } from 'react';

import {
  Alert,
  ArrowSwitch,
  Book,
  Calendar,
  CheckBox,
  Download,
  File,
  FileDirectory,
  Filter,
  Note,
  Plus,
} from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import MenuTriggerButton from 'common/MenuTriggerButton';
import UploadFileModal from 'common/uploadFileModal';
import type { TrainScheduleWithDetails } from 'modules/timetableItem/types';
import type { TimetableItem } from 'reducers/osrdconf/types';

import { MANAGE_TIMETABLE_ITEM_TYPES } from '../../consts';
import useImportTimetableItems from '../ImportTimetableItem';
import RoundTripsModal from '../RoundTrips/RoundTripsModal';
import FilterPanel from './FilterPanel';
import SelectionToolBar from './TimetableSelectionToolbar';
import type { TimetableFilters, TimetableMode } from './types';
import { exportTimetableItems, timetableHasInvalidTrainSchedule } from './utils';

type TimetableToolbarProps = {
  timetableFilters: TimetableFilters;
  timetableItems: TimetableItem[];
  filteredTrainSchedules: TrainScheduleWithDetails[];
  selectedTimetableItemIds: number[];
  showTrainDetails: boolean;
  isSelectMode: boolean;
  setSelectedTimetableItemIds: (selectedTimetableItemIds: number[]) => void;
  setShowTrainDetails: (show: boolean) => void;
  setIsSelectMode: (show: boolean) => void;
  setDisplayTimetableItemManagement: (mode: string) => void;
  refreshNge: () => Promise<void>;
  handleDeleteTimetableItems: () => void;
  handleMoveTimetableItems: () => void;
  timetableMode: TimetableMode;
  setTimetableMode: React.Dispatch<React.SetStateAction<TimetableMode>>;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
};

const TimetableToolbar = ({
  timetableFilters,
  timetableItems,
  filteredTrainSchedules,
  selectedTimetableItemIds,
  showTrainDetails,
  isSelectMode,
  setShowTrainDetails,
  setIsSelectMode,
  setSelectedTimetableItemIds,
  setDisplayTimetableItemManagement,
  refreshNge,
  handleDeleteTimetableItems,
  handleMoveTimetableItems,
  timetableMode,
  setTimetableMode,
  upsertTimetableItems,
}: TimetableToolbarProps) => {
  const { t } = useTranslation(['operational-studies', 'translation'], { keyPrefix: 'main' });

  const { infraId, timetableId } = useScenarioContext();
  const { data: pacedTrainRoundTripsData } =
    osrdEditoastApi.endpoints.getTimetableByIdRoundTripsTrainSchedules.useQuery({
      id: timetableId,
    });

  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [roundTripsModalIsOpen, setRoundTripsModalIsOpen] = useState(false);

  const { openModal, closeModal } = useContext(ModalContext);
  const importFile = useImportTimetableItems({ upsertTimetableItems });

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
    exportTimetableItems(
      selectedTimetableItemIds,
      timetableItems,
      pacedTrainRoundTripsData?.results
    );
  };

  const areAllTrainchedulesSelected =
    selectedTimetableItemIds.length === filteredTrainSchedules.length;

  const areInvalidTrainSchedules = timetableHasInvalidTrainSchedule(filteredTrainSchedules);

  const toggleAllTrainsSelection = () => {
    if (!areAllTrainchedulesSelected) {
      const trainSchedulesDisplayed = filteredTrainSchedules.map(({ id }) => id);
      setSelectedTimetableItemIds(trainSchedulesDisplayed);
    } else {
      setSelectedTimetableItemIds([]);
    }
  };

  const openTimetableImportModal = () =>
    openModal(
      <UploadFileModal
        handleSubmit={async (file) => {
          closeModal();
          await importFile(file);
        }}
      />
    );

  return (
    <>
      {areInvalidTrainSchedules && (
        <div className="invalid-trains">
          <Alert size="sm" variant="fill" />
          <span data-testid="invalid-timetable-item-message" className="invalid-trains-message">
            {t('timetable.invalidTrains')}
          </span>
        </div>
      )}
      <div
        className={cx('timetable-toolbar', {
          'are-invalid-items': areInvalidTrainSchedules,
        })}
      >
        <div className="left-group">
          <button
            className={cx('select-options-button', {
              active: isSelectMode,
            })}
            data-testid="scenarios-select-options-button"
            title={t('timetable.selectOptions')}
            onClick={toggleisSelectMode}
            disabled={timetableItems.length === 0}
            type="button"
          >
            <CheckBox />
          </button>
          <button
            className={cx('train-detail-button', {
              active: showTrainDetails,
            })}
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
          <MenuTriggerButton
            buttonProps={{
              icon: <Download />,
              dataTestID: 'scenarios-import-timetable-item-button',
              title: t('timetable.importTimetableNetworkGraphItem'),
              className: 'import-button',
            }}
            menuProps={{
              items: [
                {
                  icon: <File />,
                  title: t('timetable.importTimetableNetworkGraphFromFile'),
                  dataTestID: 'scenarios-import-timetable-by-file',
                  onClick: () => openTimetableImportModal(),
                },
                {
                  icon: <Book />,
                  title: t('timetable.importTimetableNetworkGraphFromCatalog'),
                  dataTestID: 'scenarios-import-timetable-by-catalog',
                  onClick: () =>
                    setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.catalog),
                },
              ],
            }}
          />
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
        <div className="right-group">
          <button
            className={cx('filter-button', {
              active: isFilterPanelOpen,
            })}
            data-testid="timetable-filter-button"
            title={t('timetable.toggleFilters')}
            onClick={toggleFilterPanel}
            disabled={timetableItems.length === 0}
            type="button"
          >
            <Filter />
          </button>
          <div className="timetable-sort-switch">
            <button
              className={cx('timetable-mode-button', {
                active: timetableMode === 'calendar',
              })}
              data-testid="timetable-calendar-mode-button"
              title={t('timetable.modeCalendar')}
              onClick={() => setTimetableMode('calendar')}
              type="button"
            >
              <Calendar />
            </button>

            <button
              className={cx('timetable-mode-button', {
                active: timetableMode === 'trainScheduleSet',
              })}
              data-testid="timetable-train-schedule-set-mode-button"
              title={t('timetable.modeTrainScheduleSet')}
              onClick={() => setTimetableMode('trainScheduleSet')}
              type="button"
            >
              <FileDirectory />
            </button>
          </div>
        </div>
      </div>
      {isSelectMode && filteredTrainSchedules.length > 0 && (
        <SelectionToolBar
          selectedTimetableItemIds={selectedTimetableItemIds}
          areAllTrainchedulesSelected={areAllTrainchedulesSelected}
          areInvalidTrainSchedules={areInvalidTrainSchedules}
          toggleAllTrainsSelection={toggleAllTrainsSelection}
          handleExportTimetableItems={handleExportTimetableItems}
          handleDeleteTimetableItems={handleDeleteTimetableItems}
          handleMoveTimetableItems={handleMoveTimetableItems}
        />
      )}
      {isFilterPanelOpen && (
        <div
          className={cx('sticky-filter', {
            'are-invalid-items': areInvalidTrainSchedules,
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
          trainSchedules={timetableItems}
          refreshNge={refreshNge}
        />
      )}
    </>
  );
};

export default TimetableToolbar;
