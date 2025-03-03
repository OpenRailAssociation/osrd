import { useTranslation } from 'react-i18next';

import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';

import useCheckGrant, { type GrantConfig } from './useCheckGrant';

const useProtectedActionByGrant = ({ resourceType, resourceId, requiredGrant }: GrantConfig) => {
  const { t } = useTranslation('common');
  const dispatch = useAppDispatch();

  const hasGrant = useCheckGrant({ resourceType, resourceId, requiredGrant });

  return (action: () => void) => {
    if (hasGrant) {
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

export default useProtectedActionByGrant;
