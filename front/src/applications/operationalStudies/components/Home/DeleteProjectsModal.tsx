import React from 'react';
import { ModalBodySNCF, ModalFooterSNCF, useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useTranslation } from 'react-i18next';

export default function DeleteProjectsModal({
  handleDeleteProjects,
  projectCount,
}: {
  handleDeleteProjects: () => void;
  projectCount: number;
}) {
  const { t } = useTranslation(['translation', 'operationalStudies/home']);
  const { closeModal } = useModal();
  return (
    <>
      <ModalBodySNCF>
        <div className="lead my-4 w-100 text-center">
          {t('operationalStudies/home:confirmDeleteMessage', { count: projectCount })}
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
              handleDeleteProjects();
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
