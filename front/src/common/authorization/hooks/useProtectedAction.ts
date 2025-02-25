import { useTranslation } from 'react-i18next';

import { type ResourceType } from 'common/api/mock/mockEditoastApi';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';

import useCheckPrivileges from './useCheckPrivileges';
import type { AuthorizationRequirement } from '../utils/checkPrivileges';

type UseProtectedActionParams = {
  resourceId?: number;
  resourceType: ResourceType;
} & AuthorizationRequirement;

/**
 * A custom hook that checks if the user has the required privileges to perform an action.
 * If the user has the required privileges, the action is executed. Otherwise, a failure message is dispatched.
 *
 * @param {Object} params - The parameters for the hook.
 * @param {string} params.resourceType - The type of the resource.
 * @param {string} params.resourceId - The ID of the resource.
 * @param {string} [params.requiredGrant] - The required grant for the action.
 * @param {string[]} [params.requiredPrivileges=[]] - The required privileges for the action.
 *
 * @returns {Function} A function that takes an action to be performed if the user has the required privileges.
 */
const useProtectedAction = ({
  resourceType,
  resourceId,
  requiredGrant,
  requiredPrivileges = [],
}: UseProtectedActionParams) => {
  const { t } = useTranslation('common/common');
  const dispatch = useAppDispatch();
  const hasPrivilege = useCheckPrivileges({
    resourceType,
    resourceId,
    ...(requiredGrant ? { requiredGrant } : { requiredPrivileges }),
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

export default useProtectedAction;
