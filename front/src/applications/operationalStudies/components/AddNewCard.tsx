import type { ReactNode } from 'react';

import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';

import useCheckUserRole from '../../../common/authorization/hooks/useCheckUserRole';
import { REQUIRED_USER_ROLES_FOR } from '../../../common/authorization/roleBaseAccessControl';
import { useModal } from '../../../common/BootstrapSNCF/ModalSNCF';

type AddNewCardProps = {
  testId: string;
  className: string;
  modalComponent: ReactNode;
  item: 'project' | 'study' | 'scenario';
};

const AddNewCard = ({ testId, className, modalComponent, item }: AddNewCardProps) => {
  const { t } = useTranslation('operational-studies');
  const { openModal } = useModal();

  const newProjectStudyScenarioAllowed = useCheckUserRole(
    REQUIRED_USER_ROLES_FOR.FEATURES.CREATE_NEW_PROJECT_STUDY_SCENARIO
  );

  return (
    <div
      data-testid={testId}
      className={`${className}`}
      {...(!newProjectStudyScenarioAllowed && { 'aria-disabled': true })}
      role="button"
      tabIndex={0}
      onClick={() =>
        newProjectStudyScenarioAllowed && openModal(modalComponent, 'xl', 'no-close-modal')
      }
    >
      <FaPlus />
      <div className="legend">{t(`${item}.create`)}</div>
    </div>
  );
};

export default AddNewCard;
