import { useCallback, useContext, useState } from 'react';

import { ChevronLeft, Pencil } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useItineraryModalContext } from 'applications/operationalStudies/hooks/useItineraryModalContext';
import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import { EditedElementContainerContext } from 'applications/operationalStudies/views/Scenario/components/EditedElementContainerContext';
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
  closeViewAndOpenTableBoard: (closeView: () => void) => void;
};

/**
 * Create/edit unique trains and paced trains
 */
const ManageTrainScheduleLeftPanel = ({
  closeViewAndOpenTableBoard,
}: ManageTrainScheduleLeftPanelProps) => {
  const { setEditedElementContainer } = useContext(EditedElementContainerContext);
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });
  const editingTrainType = useSelector(getEditingTrainType);
  const osrdConf = useSelector(getOperationalStudiesConf);

  const { upsertTrainSchedules } = useTimetableContext();
  const { trainScheduleToEditData, closeItineraryModal } = useItineraryModalContext();

  const { openModal, closeModal } = useModal();

  const [isWorking, setIsWorking] = useState(false);
  const [itineraryModalIsOpen, setItineraryModalIsOpen] = useState(true);

  const leaveManageTrainSchedule = () => {
    closeItineraryModal();
  };

  const updateTimetable = useUpdateTrainSchedule(setIsWorking, upsertTrainSchedules);

  const getEditLabel = (_itemToEdit: TrainScheduleToEditData) => {
    if (!_itemToEdit.originalTrainSchedule.paced && editingTrainType === 'uniqueTrain') {
      return t('updateUniqueTrain');
    }
    if (_itemToEdit.originalTrainSchedule.paced && editingTrainType !== 'uniqueTrain') {
      return editingTrainType === 'pacedTrain' ? t('updatePacedTrain') : t('updateOccurrence');
    }
    return !_itemToEdit.originalTrainSchedule.paced
      ? t('turnUniqueTrainIntoPacedTrain')
      : t('turnPacedTrainIntoUniqueTrain');
  };

  const openConfirmModal = useCallback(() => {
    if (
      trainScheduleToEditData &&
      trainScheduleToEditData.originalTrainSchedule.paced &&
      trainScheduleToEditData.originalTrainSchedule.paced.exceptions.length > 0 &&
      (osrdConf.timeWindow.toISOString() !==
        trainScheduleToEditData.originalTrainSchedule.paced.timeWindow.toISOString() ||
        osrdConf.interval.toISOString() !==
          trainScheduleToEditData.originalTrainSchedule.paced.interval.toISOString())
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
        {trainScheduleToEditData && (
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

        {trainScheduleToEditData === undefined && (
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
      {itineraryModalIsOpen && (
        <ItineraryModal
          itineraryModalIsOpen={itineraryModalIsOpen}
          onClose={({ withChanges: _ }) => {
            setItineraryModalIsOpen(false);
          }}
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
