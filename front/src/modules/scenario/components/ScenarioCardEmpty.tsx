import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';

import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import AddOrEditScenarioModal from 'modules/scenario/components/AddOrEditScenarioModal';

export default function StudyCard() {
  const { t } = useTranslation('operationalStudies/study');
  const { openModal } = useModal();

  return (
    <div
      data-testid="add-scenario-button"
      className="scenario-card empty"
      role="button"
      tabIndex={0}
      onClick={() => openModal(<AddOrEditScenarioModal />, 'xl', 'no-close-modal')}
    >
      <FaPlus />
      <div className="legend">{t('createScenario')}</div>
    </div>
  );
}
