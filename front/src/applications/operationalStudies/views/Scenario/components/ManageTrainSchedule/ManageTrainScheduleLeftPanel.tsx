import { useCallback, useContext } from 'react';

import { ChevronLeft, Pencil } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import {
  useItineraryModalContext,
  type TrainScheduleToEditData,
} from 'applications/operationalStudies/hooks/useItineraryModalContext';
import { EditedElementContainerContext } from 'applications/operationalStudies/views/Scenario/components/EditedElementContainerContext';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import { ConfirmModal, useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { toggleEditingTrainType } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getEditingTrainType,
  getOperationalStudiesConf,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { useAppDispatch } from 'store';

import PacedTrainSettings from './PacedTrainSettings';

export type ManageTrainScheduleLeftPanelProps = {
  closeViewAndOpenTableBoard: (closeView: () => void) => void;
};

// TODO: This component should be removed as soon as possible, as it's not functional anymore
//       now that we got rid of the operationalStudiesConf store.

/**
 * Create/edit unique trains and paced trains
 */
const ManageTrainScheduleLeftPanel = ({
  closeViewAndOpenTableBoard: _unused,
}: ManageTrainScheduleLeftPanelProps) => {
  const { setEditedElementContainer } = useContext(EditedElementContainerContext);
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });
  const editingTrainType = useSelector(getEditingTrainType);
  const osrdConf = useSelector(getOperationalStudiesConf);

  const { trainScheduleToEditData, closeItineraryModal } = useItineraryModalContext();

  const { openModal, closeModal } = useModal();

  const leaveManageTrainSchedule = () => {
    closeItineraryModal();
  };

  const getEditLabel = (itemToEdit: TrainScheduleToEditData) => {
    if (!itemToEdit.trainSchedule.paced && editingTrainType === 'uniqueTrain') {
      return t('updateUniqueTrain');
    }
    if (itemToEdit.trainSchedule.paced && editingTrainType !== 'uniqueTrain') {
      return editingTrainType === 'pacedTrain' ? t('updatePacedTrain') : t('updateOccurrence');
    }
    return !itemToEdit.trainSchedule.paced
      ? t('turnUniqueTrainIntoPacedTrain')
      : t('turnPacedTrainIntoUniqueTrain');
  };

  const openConfirmModal = useCallback(() => {
    if (
      trainScheduleToEditData &&
      trainScheduleToEditData.trainSchedule.paced &&
      trainScheduleToEditData.trainSchedule.paced.exceptions.length > 0 &&
      (osrdConf.timeWindow.toISOString() !==
        trainScheduleToEditData.trainSchedule.paced.timeWindow.toISOString() ||
        osrdConf.interval.toISOString() !==
          trainScheduleToEditData.trainSchedule.paced.interval.toISOString())
    ) {
      openModal(
        <ConfirmModal
          title={t('pacedTrains.resetExceptionsConfirmation')}
          onConfirm={() => {
            closeModal();
          }}
          onCancel={closeModal}
          withCloseButton={false}
        />,
        'sm'
      );
    }
  }, [closeModal, osrdConf.interval, osrdConf.timeWindow, trainScheduleToEditData, openModal, t]);

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
      </div>
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
