import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';

import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import AddOrEditProjectModal from 'modules/project/components/AddOrEditProjectModal';

export default function ProjectCard() {
  const { t } = useTranslation('operationalStudies/home');
  const { openModal } = useModal();

  return (
    <div
      data-testid="add-project"
      className="project-card empty"
      role="button"
      tabIndex={0}
      onClick={() => openModal(<AddOrEditProjectModal />, 'xl', 'no-close-modal')}
    >
      <FaPlus />
      <div className="legend">{t('createProject')}</div>
    </div>
  );
}
