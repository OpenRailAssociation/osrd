import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { useTranslation } from 'react-i18next';

import { useCheckProtectedAction } from '../hooks/useProtectedAction';
import type { Privilege } from '../types';

type ProtectedButtonProps = {
  children: ReactNode;
  userPrivileges: Set<Privilege>;
  requiredPrivileges: Privilege[];
  onClick: () => void;
} & Partial<ButtonHTMLAttributes<HTMLButtonElement>>;

/**
 * Create a standard button, on which the action is protected based on the user privileges and the requirements.
 */
const ProtectedButton = ({
  children,
  userPrivileges,
  requiredPrivileges,
  onClick,
  title,
  ...btnProps
}: ProtectedButtonProps) => {
  const { t } = useTranslation();
  const checkAction = useCheckProtectedAction();
  const forbidden = requiredPrivileges.some((privilege) => !userPrivileges.has(privilege));

  return (
    <button
      type="button"
      aria-label={title}
      disabled={forbidden}
      title={forbidden ? t('authorization.permissionDenied') : title}
      onClick={() => checkAction(userPrivileges, requiredPrivileges, onClick)}
      {...btnProps}
    >
      {children}
    </button>
  );
};

export default ProtectedButton;
