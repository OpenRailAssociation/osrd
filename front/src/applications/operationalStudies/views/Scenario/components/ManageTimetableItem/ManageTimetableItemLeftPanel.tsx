import { useContext, useState } from 'react';

import { ChevronLeft, Pencil } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { EditedElementContainerContext } from 'applications/operationalStudies/views/Scenario/components/EditedElementContainerContext';
import { MANAGE_TIMETABLE_ITEM_TYPES } from 'applications/operationalStudies/views/Scenario/consts';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import { ConfirmModal, useModal } from 'common/BootstrapSNCF/ModalSNCF';
import DotsLoader from 'common/DotsLoader';
import { toggleEditingItemType } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getEditingItemType,
  getOperationalStudiesConf,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type {
  TimetableItemId,
  TimetableItem,
  TimetableItemToEditData,
} from 'reducers/osrdconf/types';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { isPacedTrainId, isTrainScheduleId } from 'utils/trainId';

import CreateTimetableItemButton from './CreateTimetableItemButton';
import { isPacedTrainToEditData } from './helpers/formatTimetableItemPayload';
import useUpdateTimetableItem from './hooks/useUpdateTimetableItem';
import ItineraryModal from './Itinerary/ItineraryModal';
import PacedTrainSettings from './PacedTrainSettings';

export type ManageTimetableItemLeftPanelProps = {
  displayTimetableItemManagement: string;
  timetableItemToEditData?: TimetableItemToEditData;
  setDisplayTimetableItemManagement: (type: string) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  removeTimetableItems: (timetableItems: TimetableItemId[]) => void;
  setTimetableItemToEditData: (timetableItemToEditData?: TimetableItemToEditData) => void;
};

/**
 * Create/edit train schedules and paced trains
 */
const ManageTimetableItemLeftPanel = ({
  displayTimetableItemManagement,
  setDisplayTimetableItemManagement,
  upsertTimetableItems,
  removeTimetableItems,
  timetableItemToEditData,
  setTimetableItemToEditData,
}: ManageTimetableItemLeftPanelProps) => {
  const { setEditedElementContainer } = useContext(EditedElementContainerContext);
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });
  const editingItemType = useSelector(getEditingItemType);
  const selectedTrainId = useSelector(getSelectedTrainId);
  const osrdConf = useSelector(getOperationalStudiesConf);

  const { openModal, closeModal } = useModal();

  const [isWorking, setIsWorking] = useState(false);
  const [itineraryModalIsOpen, setItineraryModalIsOpen] = useState(false);

  const leaveManageTimetableItem = () => {
    setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.none);
    setTimetableItemToEditData(undefined);
  };

  const updateTimetable = useUpdateTimetableItem(
    setIsWorking,
    setDisplayTimetableItemManagement,
    upsertTimetableItems,
    removeTimetableItems,
    setTimetableItemToEditData,
    timetableItemToEditData,
    selectedTrainId
  );

  const getEditLabel = (_itemIdToEdit: TimetableItemId) => {
    if (isTrainScheduleId(_itemIdToEdit) && editingItemType === 'trainSchedule') {
      return t('updateTrainSchedule');
    }
    if (isPacedTrainId(_itemIdToEdit) && editingItemType !== 'trainSchedule') {
      return editingItemType === 'pacedTrain' ? t('updatePacedTrain') : t('updateOccurrence');
    }
    return isTrainScheduleId(_itemIdToEdit)
      ? t('turnTrainScheduleIntoPacedTrain')
      : t('turnPacedTrainIntoTrainSchedule');
  };

  return (
    <div className="scenario-timetable-manage-timetable-item left-column">
      <div className="scenario-timetable-manage-timetable-item-header">
        {displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.edit &&
          timetableItemToEditData && (
            <>
              <button
                className="btn btn-warning mb-2"
                type="button"
                onClick={() => {
                  if (
                    isPacedTrainToEditData(timetableItemToEditData) &&
                    timetableItemToEditData.originalPacedTrain.exceptions.length > 0 &&
                    (osrdConf.timeWindow.toISOString() !==
                      timetableItemToEditData.originalPacedTrain.paced.timeWindow.toISOString() ||
                      osrdConf.interval.toISOString() !==
                        timetableItemToEditData.originalPacedTrain.paced.interval.toISOString())
                  ) {
                    openModal(
                      <ConfirmModal
                        title={t('pacedTrains.resetExceptionsConfirmation')}
                        onConfirm={() => {
                          updateTimetable();
                          closeModal();
                        }}
                        onCancel={closeModal}
                        withCloseButton={false}
                      />,
                      'sm'
                    );
                  } else {
                    updateTimetable();
                  }
                }}
                data-testid="submit-edit-timetable-item"
              >
                <span className="mr-2">
                  <Pencil size="lg" />
                </span>
                {getEditLabel(timetableItemToEditData.timetableItemId)}
              </button>
              {editingItemType !== 'occurrence' && (
                <div className="osrd-config-item-container paced-trains-container">
                  <CheckboxRadioSNCF
                    type="checkbox"
                    label={t('pacedTrains.defineService')}
                    id="define-paced-train"
                    name="define-paced-train"
                    containerClassName="mb-0"
                    checked={editingItemType === 'pacedTrain'}
                    onChange={() => dispatch(toggleEditingItemType())}
                  />
                  {editingItemType === 'pacedTrain' && <PacedTrainSettings />}
                </div>
              )}
            </>
          )}

        {displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.add && (
          <>
            {isWorking ? (
              <button
                className="btn btn-primary disabled mb-2"
                type="button"
                aria-label={t('saving')}
                title={t('saving')}
              >
                <DotsLoader />
              </button>
            ) : (
              <CreateTimetableItemButton
                setIsWorking={setIsWorking}
                upsertTimetableItems={upsertTimetableItems}
                isPacedTrainMode={editingItemType === 'pacedTrain'}
              />
            )}
            <div className="osrd-config-item-container paced-trains-container">
              <CheckboxRadioSNCF
                type="checkbox"
                label={t('pacedTrains.defineService')}
                id="define-paced-train"
                name="define-paced-train"
                containerClassName="mb-0"
                checked={editingItemType === 'pacedTrain'}
                onChange={() => dispatch(toggleEditingItemType())}
              />
              {editingItemType === 'pacedTrain' && <PacedTrainSettings />}
            </div>
          </>
        )}
      </div>
      {(displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.add ||
        displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.edit) && (
        <div
          className="scenario-timetable-manage-timetable-item-body"
          role="button"
          tabIndex={0}
          onClick={() => setItineraryModalIsOpen(true)}
        >
          <button
            className="btn btn-light btn-block text-truncate pr-2"
            title={t('itineraryModal.openItineraryModal')}
            type="button"
          >
            <span className="mr-2">
              <ChevronLeft size="lg" />
            </span>
            {t('itineraryModal.openItineraryModal')}
          </button>
        </div>
      )}
      {itineraryModalIsOpen && (
        <ItineraryModal
          itineraryModalIsOpen={itineraryModalIsOpen}
          setItineraryModalIsOpen={setItineraryModalIsOpen}
          displayTimetableItemManagement={displayTimetableItemManagement}
        />
      )}
      <div
        className="scenario-timetable-manage-timetable-item-body"
        role="button"
        tabIndex={0}
        onClick={leaveManageTimetableItem}
      >
        <button
          className="btn btn-secondary btn-block"
          data-testid="return-simulation-result"
          type="button"
        >
          <span className="mr-2">
            <ChevronLeft size="lg" />
          </span>
          {t('returnToSimulationResults')}
        </button>
      </div>
      <div ref={setEditedElementContainer} id="timetable-edited-element" />
    </div>
  );
};

export default ManageTimetableItemLeftPanel;
