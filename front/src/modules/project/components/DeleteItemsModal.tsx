import React from 'react';

import { useTranslation } from 'react-i18next';

import { ModalBodySNCF, ModalFooterSNCF, useModal } from 'common/BootstrapSNCF/ModalSNCF';

export default function DeleteItemsModal({
  handleDeleteItems,
  translationKey,
}: {
  handleDeleteItems: () => void;
  translationKey: string;
}) {
  const { t } = useTranslation(['translation', 'operationalStudies/home']);
  const { closeModal } = useModal();
  return (
    <>
      <ModalBodySNCF>
        <div className="lead my-4 w-100 text-center">{translationKey}</div>
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <div className="d-flex align-items-center">
          <button className="btn btn-secondary flex-grow-1" type="button" onClick={closeModal}>
            {t('translation:common.cancel')}
          </button>
          <button
            data-testid="deleteProject"
            className="btn btn-danger flex-grow-1 ml-1"
            type="button"
            onClick={() => {
              handleDeleteItems();
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
