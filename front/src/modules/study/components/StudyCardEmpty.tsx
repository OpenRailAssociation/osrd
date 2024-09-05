import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';

import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import AddOrEditStudyModal from 'modules/study/components/AddOrEditStudyModal';

export default function StudyCard() {
  const { t } = useTranslation(['operationalStudies/project', 'operationalStudies/study']);
  const { openModal } = useModal();

  return (
    <div
      data-testid="add-study-button"
      className="study-card empty"
      role="button"
      tabIndex={0}
      onClick={() => openModal(<AddOrEditStudyModal />, 'xl', 'no-close-modal')}
    >
      <FaPlus />
      <div className="legend">{t('createStudy')}</div>
    </div>
  );
}
