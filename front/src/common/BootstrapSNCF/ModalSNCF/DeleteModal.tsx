import { useTranslation } from 'react-i18next';

import { ModalBodySNCF, ModalFooterSNCF, useModal } from 'common/BootstrapSNCF/ModalSNCF';

type DeleteModalProps = {
  handleDelete: () => void;
  selectedPacedTrainCount?: number;
  selectedUniqueTrainCount?: number;
};

const DeleteModal = ({
  handleDelete,
  selectedPacedTrainCount = 0,
  selectedUniqueTrainCount = 0,
}: DeleteModalProps) => {
  const { t } = useTranslation(['operational-studies', 'translation']);
  const { closeModal } = useModal();

  const deleteTrainSchedulesComputedLabel = () => {
    if (selectedPacedTrainCount > 0 && selectedUniqueTrainCount === 0) {
      return t('main.timetable.deletePacedTrainSelectionConfirmation', {
        selectedPacedTrainsCount: selectedPacedTrainCount,
      });
    }

    if (selectedUniqueTrainCount > 0 && selectedPacedTrainCount === 0) {
      return t('main.timetable.deleteTrainSelectionConfirmation', {
        selectedUniqueTrainsCount: selectedUniqueTrainCount,
      });
    }

    return t('main.timetable.deletePacedTrainAndTrainSelectionConfirmation', {
      selectedPacedTrainsCount: selectedPacedTrainCount,
      selectedUniqueTrainsCount: selectedUniqueTrainCount,
    });
  };
  return (
    <>
      <ModalBodySNCF>
        <div className="lead my-4 w-100 text-center">{deleteTrainSchedulesComputedLabel()}</div>
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
