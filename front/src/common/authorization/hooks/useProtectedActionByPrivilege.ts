import { useTranslation } from 'react-i18next';

import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';

import { useCheckPrivilege, type PrivilegeConfig } from './useCheckPrivilege';

const useProtectedActionByPrivilege = ({
  resourceType,
  resourceId,
  requiredPrivilege,
}: PrivilegeConfig) => {
  const { t } = useTranslation('common');
  const dispatch = useAppDispatch();

  const hasPrivilege = useCheckPrivilege({
    resourceType,
    resourceId,
    requiredPrivilege,
  });

  return (action: () => void) => {
    if (hasPrivilege) {
      action();
      return;
    }

    dispatch(
      setFailure({
        name: t('authorization.permission'),
        message: t('authorization.permissionDenied'),
      })
    );
  };
};

export default useProtectedActionByPrivilege;
