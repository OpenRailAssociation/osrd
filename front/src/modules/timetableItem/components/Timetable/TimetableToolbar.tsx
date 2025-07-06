import { useContext, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { Alert, ArrowSwitch, Filter } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { osrdEditoastApi, type PacedTrain, type TrainSchedule } from 'common/api/osrdEditoastApi';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { setFailure, setSuccess } from 'reducers/main';
import type {
  PacedTrainId,
  TimetableItemId,
  TimetableItem,
  TrainId,
  TrainScheduleId,
} from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  isPacedTrainResponseWithPacedTrainId,
  isTrainScheduleId,
} from 'utils/trainId';

import FilterPanel from './FilterPanel';
import RoundTripsModal from './RoundTrips/RoundTripsModal';
import type { TimetableFilters, TimetableItemWithDetails } from './types';
import { timetableHasInvalidItem } from './utils';

type TimetableToolbarProps = {
  showTrainDetails: boolean;
  toggleShowTrainDetails: () => void;
  filteredTimetableItems: TimetableItemWithDetails[];
  timetableFilters: TimetableFilters;
  selectedTimetableItemIds: TimetableItemId[];
  removeTrains: (trainIds: TimetableItemId[]) => void;
  timetableItems: TimetableItem[];
  isInSelection: boolean;
  selectedTrainScheduleIds: TrainScheduleId[];
  selectedPacedTrainIds: PacedTrainId[];
};

const TimetableToolbar = ({
  showTrainDetails,
  toggleShowTrainDetails,
  filteredTimetableItems,
  timetableFilters,
  selectedTimetableItemIds,
  removeTrains,
  timetableItems,
  isInSelection,
  selectedTrainScheduleIds,
  selectedPacedTrainIds,
}: TimetableToolbarProps) => {
  const { t } = useTranslation(['operational-studies', 'translation'], { keyPrefix: 'main' });
  const dispatch = useAppDispatch();
  const { openModal } = useContext(ModalContext);
  const { infraId } = useScenarioContext();

  const selectedTrainId = useSelector(getSelectedTrainId);

  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [roundTripsModalIsOpen, setRoundTripsModalIsOpen] = useState(false);

  const [deleteTrainSchedules] = osrdEditoastApi.endpoints.deleteTrainSchedule.useMutation();
  const [deletePacedTrains] = osrdEditoastApi.endpoints.deletePacedTrain.useMutation();

  const toggleFilterPanel = () => {
    setIsFilterPanelOpen(!isFilterPanelOpen);
  };

  const handleTrainsDelete = async (currentSelectedTrainId?: TrainId) => {
    const itemsCount = selectedTimetableItemIds.length;

    const isSelectedTimetableItemInSelection =
      currentSelectedTrainId !== undefined &&
      selectedTimetableItemIds.some((timetableItemId) =>
        isTrainScheduleId(timetableItemId)
          ? timetableItemId === currentSelectedTrainId
          : currentSelectedTrainId.includes(timetableItemId)
      );

    if (isSelectedTimetableItemInSelection) {
      // we need to set selectedTrainId to undefined, otherwise just after the delete,
      // some unvalid rtk calls are dispatched (see rollingstock request in SimulationResults)
      dispatch(updateSelectedTrainId(undefined));
    }

    const editoastSelectedTrainScheduleIds = selectedTrainScheduleIds.map((id) =>
      extractEditoastIdFromTrainScheduleId(id)
    );
    const editoastSelectedPacedTrainIds = selectedPacedTrainIds.map((id) =>
      extractEditoastIdFromPacedTrainId(id)
    );

    try {
      let deletingTrainSchedulesPromise;
      let deletingPacedTrainsPromise;
      if (editoastSelectedTrainScheduleIds.length > 0) {
        deletingTrainSchedulesPromise = deleteTrainSchedules({
          body: { ids: editoastSelectedTrainScheduleIds },
        }).unwrap();
      }
      if (editoastSelectedPacedTrainIds.length > 0) {
        deletingPacedTrainsPromise = deletePacedTrains({
          body: { ids: editoastSelectedPacedTrainIds },
        }).unwrap();
      }
      await Promise.all([deletingTrainSchedulesPromise, deletingPacedTrainsPromise]);

      removeTrains(selectedTimetableItemIds);
      dispatch(
        setSuccess({
          title: t('timetable.itemsSelectionDeletedCount', { count: itemsCount }),
          text: '',
        })
      );
    } catch (e) {
      if (isSelectedTimetableItemInSelection) {
        dispatch(updateSelectedTrainId(currentSelectedTrainId));
      } else {
        dispatch(setFailure(castErrorToFailure(e)));
      }
    }
  };

  const exportTimetableItems = (selectedTimeTableIdsFromClick: TimetableItemId[]) => {
    if (!timetableItems) return;

    const formattedTimetableItems = timetableItems
      .filter(({ id }) => selectedTimeTableIdsFromClick.includes(id))
      .reduce<{
        train_schedules: TrainSchedule[];
        paced_trains: PacedTrain[];
      }>(
        (acc, timetableItem) => {
          if (isPacedTrainResponseWithPacedTrainId(timetableItem)) {
            acc.paced_trains.push(omit(timetableItem, ['id']));
          } else {
            acc.train_schedules.push(omit(timetableItem, ['id']));
          }
          return acc;
        },
        { train_schedules: [], paced_trains: [] }
      );

    const jsonString = JSON.stringify(formattedTimetableItems);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timetable.json';
    a.click();
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

        {selectedTimetableItemIds.length > 0 && (
          <div className="action-buttons">
            <Button
              data-testid="delete-all-items-button"
              size="small"
              variant="Destructive"
              label={t('timetable.delete')}
              title={t('timetable.deleteSelection')}
              onClick={() =>
                openModal(
                  <DeleteModal
                    handleDelete={() => handleTrainsDelete(selectedTrainId)}
                    selectedPacedTrainIds={selectedPacedTrainIds}
                    selectedTrainScheduleIds={selectedTrainScheduleIds}
                  />,
                  'sm'
                )
              }
            />
            <Button
              size="small"
              label={t('timetable.export')}
              title={t('timetable.exportSelection')}
              type="button"
              onClick={() => exportTimetableItems(selectedTimetableItemIds)}
            />
          </div>
        )}
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
