import { useCallback, useContext, useEffect, useState } from 'react';

import { ChevronLeft, Pencil } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { EditedElementContainerContext } from 'applications/operationalStudies/views/Scenario/components/EditedElementContainerContext';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/views/Scenario/consts';
import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import { ConfirmModal, useModal } from 'common/BootstrapSNCF/ModalSNCF';
import DotsLoader from 'common/DotsLoader';
import { toggleEditingTrainType } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getEditingTrainType,
  getOperationalStudiesConf,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { TrainScheduleToEditData } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import CreateTrainScheduleButton from './CreateTrainScheduleButton';
import useUpdateTrainSchedule from './hooks/useUpdateTrainSchedule';
import ItineraryModal from './Itinerary/ItineraryModal';
import PacedTrainSettings from './PacedTrainSettings';

export type ManageTrainScheduleLeftPanelProps = {
  displayTrainScheduleManagement: string;
  trainScheduleToEditData?: TrainScheduleToEditData;
  setDisplayTrainScheduleManagement: (type: string) => void;
  upsertTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
  setTrainScheduleToEditData: (trainScheduleToEditData?: TrainScheduleToEditData) => void;
  closeViewAndOpenTableBoard: (closeView: () => void) => void;
};

/**
 * Create/edit unique trains and paced trains
 */
const ManageTrainScheduleLeftPanel = ({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
  upsertTrainSchedules,
  trainScheduleToEditData,
  setTrainScheduleToEditData,
  closeViewAndOpenTableBoard,
}: ManageTrainScheduleLeftPanelProps) => {
  const { setEditedElementContainer } = useContext(EditedElementContainerContext);
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });
  const editingTrainType = useSelector(getEditingTrainType);
  const osrdConf = useSelector(getOperationalStudiesConf);

  const { openModal, closeModal } = useModal();

  const [isWorking, setIsWorking] = useState(false);
  const [itineraryModalIsOpen, setItineraryModalIsOpen] = useState(
    displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add ||
      displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit ||
      displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.itinerary
  );
  const [itineraryChanged, setItineraryChanged] = useState(false);

  const leaveManageTrainSchedule = () => {
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
    setTrainScheduleToEditData(undefined);
  };

  const updateTimetable = useUpdateTrainSchedule(
    setIsWorking,
    setDisplayTrainScheduleManagement,
    upsertTrainSchedules,
    setTrainScheduleToEditData,
    trainScheduleToEditData
  );

  const getEditLabel = (_itemToEdit: TrainScheduleToEditData) => {
    if (!_itemToEdit.originalPacedTrain.paced && editingTrainType === 'uniqueTrain') {
      return t('updateUniqueTrain');
    }
    if (_itemToEdit.originalPacedTrain.paced && editingTrainType !== 'uniqueTrain') {
      return editingTrainType === 'pacedTrain' ? t('updatePacedTrain') : t('updateOccurrence');
    }
    return !_itemToEdit.originalPacedTrain.paced
      ? t('turnUniqueTrainIntoPacedTrain')
      : t('turnPacedTrainIntoUniqueTrain');
  };

  useEffect(() => {
    if (
      displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.itinerary &&
      !itineraryModalIsOpen
    ) {
      if (itineraryChanged) {
        updateTimetable();
      } else {
        leaveManageTrainSchedule();
      }
    }
  }, [displayTrainScheduleManagement, itineraryModalIsOpen, itineraryChanged]);

  const openConfirmModal = useCallback(() => {
    if (
      trainScheduleToEditData &&
      trainScheduleToEditData.originalPacedTrain.paced &&
      trainScheduleToEditData.originalPacedTrain.paced.exceptions.length > 0 &&
      (osrdConf.timeWindow.toISOString() !==
        trainScheduleToEditData.originalPacedTrain.paced.timeWindow.toISOString() ||
        osrdConf.interval.toISOString() !==
          trainScheduleToEditData.originalPacedTrain.paced.interval.toISOString())
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
  }, [
    closeModal,
    osrdConf.interval,
    osrdConf.timeWindow,
    trainScheduleToEditData,
    updateTimetable,
    openModal,
    t,
  ]);

  return (
    <div className="scenario-timetable-manage-train-schedule left-column">
      <div className="scenario-timetable-manage-train-schedule-header">
        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit &&
          trainScheduleToEditData && (
            <>
              <button
                className="btn btn-warning mb-2"
                type="button"
                onClick={openConfirmModal}
                data-testid="submit-edit-train-schedule"
              >
                <span className="mr-2">
                  <Pencil size="lg" />
                </span>
                {getEditLabel(trainScheduleToEditData)}
              </button>
              {editingTrainType !== 'occurrence' && (
                <div className="osrd-config-item-container paced-trains-container">
                  <CheckboxRadioSNCF
                    type="checkbox"
                    label={t('pacedTrains.defineService')}
                    id="define-paced-train"
                    name="define-paced-train"
                    containerClassName="mb-0"
                    checked={editingTrainType === 'pacedTrain'}
                    onChange={() => dispatch(toggleEditingTrainType())}
                  />
                  {editingTrainType === 'pacedTrain' && <PacedTrainSettings />}
                </div>
              )}
            </>
          )}

        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add && (
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
              <CreateTrainScheduleButton
                setIsWorking={setIsWorking}
                upsertTrainSchedules={upsertTrainSchedules}
                closeManageTrainScheduleAndOpenTableBoard={() =>
                  closeViewAndOpenTableBoard(leaveManageTrainSchedule)
                }
              />
            )}
            <div className="osrd-config-item-container paced-trains-container">
              <CheckboxRadioSNCF
                type="checkbox"
                label={t('pacedTrains.defineService')}
                id="define-paced-train"
                name="define-paced-train"
                containerClassName="mb-0"
                checked={editingTrainType === 'pacedTrain'}
                onChange={() => dispatch(toggleEditingTrainType())}
              />
              {editingTrainType === 'pacedTrain' && <PacedTrainSettings />}
            </div>
          </>
        )}
      </div>
      {(displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add ||
        displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit) && (
        <div
          className="scenario-timetable-manage-train-schedule-body"
          role="button"
          tabIndex={0}
          data-testid="open-itinerary-modal-button"
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
          onClose={({ withChanges }) => {
            setItineraryModalIsOpen(false);
            setItineraryChanged(withChanges);
          }}
          displayTrainScheduleManagement={displayTrainScheduleManagement}
        />
      )}
      <div
        className="scenario-timetable-manage-train-schedule-body"
        role="button"
        tabIndex={0}
        onClick={leaveManageTrainSchedule}
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

export default ManageTrainScheduleLeftPanel;
