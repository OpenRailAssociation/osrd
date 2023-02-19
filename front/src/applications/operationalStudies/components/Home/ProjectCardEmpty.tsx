import React, { useContext } from 'react';
import AddOrEditProjectModal from 'applications/operationalStudies/components/Project/AddOrEditProjectModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';

export default function ProjectCard() {
  const { t } = useTranslation('operationalStudies/home');
  const { openModal } = useContext(ModalContext);

  return (
    <div
      className="projects-list-project-card empty"
      role="button"
      tabIndex={0}
      onClick={() => openModal(<AddOrEditProjectModal />, 'xl')}
    >
      <FaPlus />
      <div className="legend">{t('createProject')}</div>
    </div>
  );
}
