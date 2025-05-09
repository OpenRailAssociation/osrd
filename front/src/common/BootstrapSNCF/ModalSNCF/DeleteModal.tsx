import { useTranslation } from 'react-i18next';

import { ModalBodySNCF, ModalFooterSNCF, useModal } from 'common/BootstrapSNCF/ModalSNCF';
import type { PacedTrainId, TrainScheduleId } from 'reducers/osrdconf/types';

type DeleteModalProps = {
  handleDelete: () => void;
  selectedPacedTrainIds: PacedTrainId[];
  selectedTrainScheduleIds: TrainScheduleId[];
};

const DeleteModal = ({
  handleDelete,
  selectedPacedTrainIds,
  selectedTrainScheduleIds,
}: DeleteModalProps) => {
  const { t } = useTranslation(['operational-studies', 'translation']);
  const { closeModal } = useModal();

  const deleteTimetableItemsComputedLabel = () => {
    if (selectedPacedTrainIds.length > 0 && selectedTrainScheduleIds.length === 0) {
      return t('main.timetable.deletePacedTrainSelectionConfirmation', {
        selectedPacedTrainsCount: selectedPacedTrainIds.length,
      });
    }

    if (selectedTrainScheduleIds.length > 0 && selectedPacedTrainIds.length === 0) {
      return t('main.timetable.deleteTrainSelectionConfirmation', {
        selectedTrainSchedulesCount: selectedTrainScheduleIds.length,
      });
    }

    return t('main.timetable.deletePacedTrainAndTrainSelectionConfirmation', {
      selectedPacedTrainsCount: selectedPacedTrainIds.length,
      selectedTrainSchedulesCount: selectedTrainScheduleIds.length,
    });
  };
  return (
    <>
      <ModalBodySNCF>
        <div className="lead my-4 w-100 text-center">{deleteTimetableItemsComputedLabel()}</div>
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <div className="d-flex align-items-center">
          <button className="btn btn-secondary flex-grow-1" type="button" onClick={closeModal}>
            {t('translation:common.cancel')}
          </button>
          <button
            data-testid="confirmation-modal-delete-button"
            className="btn btn-danger flex-grow-1 ml-1"
            type="button"
            onClick={() => {
              handleDelete();
              closeModal();
            }}
          >
            {t('translation:common.delete')}
          </button>
        </div>
      </ModalFooterSNCF>
    </>
  );
};

export default DeleteModal;
