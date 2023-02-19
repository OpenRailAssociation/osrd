import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import AddOrEditScenarioModal from 'applications/operationalStudies/components/Scenario/AddOrEditScenarioModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { FaPlus } from 'react-icons/fa';

export default function StudyCard() {
  const { t } = useTranslation('operationalStudies/study');
  const { openModal } = useContext(ModalContext);

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
