import type { ReactNode } from 'react';

import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';

import RoleBasedContent from './authorization/components/RoleBasedContent';
import { REQUIRED_USER_ROLES_FOR } from './authorization/roleBaseAccessControl';
import { useModal } from './BootstrapSNCF/ModalSNCF';

type AddNewCardProps = {
  translationNamespaces?: string[] | string;
  testId: string;
  className: string;
  modalComponent: ReactNode;
  legendTranslationKey: string;
};

const AddNewCard = ({
  translationNamespaces,
  testId,
  className,
  modalComponent,
  legendTranslationKey,
}: AddNewCardProps) => {
  const { t } = useTranslation(translationNamespaces);
  const { openModal } = useModal();

  return (
    <RoleBasedContent
      requiredRoles={REQUIRED_USER_ROLES_FOR.FEATURES.CREATE_NEW_PROJECT_STUDY_SCENARIO}
      disableIfUnauthorized
    >
      <div
        data-testid={testId}
        className={className}
        role="button"
        tabIndex={0}
        onClick={() => openModal(modalComponent, 'xl', 'no-close-modal')}
      >
        <FaPlus />
        <div className="legend">{t(legendTranslationKey)}</div>
      </div>
    </RoleBasedContent>
  );
};

export default AddNewCard;
