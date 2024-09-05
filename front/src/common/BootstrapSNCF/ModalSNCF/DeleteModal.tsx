import { useTranslation } from 'react-i18next';

import { ModalBodySNCF, ModalFooterSNCF, useModal } from 'common/BootstrapSNCF/ModalSNCF';

export default function DeleteModal({
  handleDelete,
  items,
}: {
  handleDelete: () => void;
  items: string;
}) {
  const { t } = useTranslation(['translation', 'common/common']);
  const { closeModal } = useModal();
  return (
    <>
      <ModalBodySNCF>
        <div className="lead my-4 w-100 text-center">
          {t('common/common:actions.deleteSelectionCount', { items })}
        </div>
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <div className="d-flex align-items-center">
          <button className="btn btn-secondary flex-grow-1" type="button" onClick={closeModal}>
            {t('translation:common.cancel')}
          </button>
          <button
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
}
