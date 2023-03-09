import React from 'react';
import { useTranslation } from 'react-i18next';
import AddOrEditScenarioModal from 'applications/operationalStudies/components/Scenario/AddOrEditScenarioModal';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { FaPlus } from 'react-icons/fa';

export default function StudyCard() {
  const { t } = useTranslation('operationalStudies/study');
  const { openModal } = useModal();

  return (
    <div
      className="scenarios-list-card empty"
      role="button"
      tabIndex={0}
      onClick={() => openModal(<AddOrEditScenarioModal />, 'xl')}
    >
      <FaPlus />
      <div className="legend">{t('createScenario')}</div>
    </div>
  );
}
