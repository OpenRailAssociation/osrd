import { useCallback } from 'react';

import { useTranslation } from 'react-i18next';

import { type Privilege, type ResourceType } from 'common/authorization/types';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';

import useAuthz from './useAuthz';

/**
 * Return a function that dispatches a failure message when the user is unauthorized.
 */
const useNotifyUnauthorized = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const notifyUnauthorized = useCallback(() => {
    dispatch(
      setFailure({
        name: t('authorization.permission'),
        message: t('authorization.permissionDenied'),
      })
    );
  }, [dispatch, t]);

  return notifyUnauthorized;
};

/**
 * Hook that return a function which takes user's privileges, required privileges, and an action.
 * It checks if the user has the required privileges to perform the action.
 * If the user does not have the required privileges, it dispatches a failure message.
 */
export const useCheckProtectedAction = () => {
  const notifyUnauthorized = useNotifyUnauthorized();

  const actionWrapper = useCallback(
    async (
      userPrivileges: Set<Privilege>,
      requiredPrivileges: Privilege[],
      action: () => void | Promise<void>
    ) => {
      if (requiredPrivileges.some((privilege) => !userPrivileges.has(privilege))) {
        notifyUnauthorized();
        return;
      }
      action();
    },
    [notifyUnauthorized]
  );

  return actionWrapper;
};

type UseProtectedActionParams = {
  resourceId?: number;
  resourceType: ResourceType;
  privileges: Privilege[];
};

/**
 * A custom hook that checks if the user has the required privileges to perform an action.
 * If the user has the required privileges, the action is executed. Otherwise, a failure message is dispatched.
 *
 * @param {Object} params - The parameters for the hook.
 * @param {string} params.resourceType - The type of the resource.
 * @param {string} params.resourceId - The ID of the resource.
 * @param {string[]} [params.privileges=[]] - The required privileges for the action.
 *
 * @returns {Function} A function that takes an action to be performed if the user has the required privileges.
 */
const useProtectedAction = ({ resourceType, resourceId, privileges }: UseProtectedActionParams) => {
  const notifyUnauthorized = useNotifyUnauthorized();
  const { checkUserPrivileges } = useAuthz();

  const actionWrapper = useCallback(
    async (action: () => void | Promise<void>) => {
      if (resourceId === undefined) return;
      const hasPrivilege = await checkUserPrivileges(resourceType, resourceId, privileges);
      if (!hasPrivilege) {
        notifyUnauthorized();
        return;
      }
      action();
    },
    [resourceType, resourceId, privileges, checkUserPrivileges, notifyUnauthorized]
  );

  return actionWrapper;
};

export default useProtectedAction;
