import React from 'react';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import projectLogo from 'assets/pictures/views/projects.svg';
import { useTranslation } from 'react-i18next';

export default function AddAndEditProjectModal() {
  const { t } = useTranslation('operationalStudies/home');
  return (
    <div className="project-creation-modal">
      <ModalHeaderSNCF>
        <h1 className="project-creation-modal-title">
          <img src={projectLogo} alt="Projects Logo" />
          {t('projectCreationTitle')}
        </h1>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        Contenu
      </ModalBodySNCF>
    </div>
  )
}
