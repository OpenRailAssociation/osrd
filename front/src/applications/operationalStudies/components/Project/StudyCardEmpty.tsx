import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';
import AddOrEditStudyModal from 'applications/operationalStudies/components/Study/AddOrEditStudyModal';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';

export default function StudyCard() {
  const { t } = useTranslation(['operationalStudies/project', 'operationalStudies/study']);
  const { openModal } = useModal();

  return (
    <div
      className="studies-list-card empty"
      role="button"
      tabIndex={0}
      onClick={() => openModal(<AddOrEditStudyModal />, 'xl')}
    >
      <FaPlus />
      <div className="legend">{t('createStudy')}</div>
    </div>
  );
}
