import { useMemo } from 'react';

import { REQUIRED_USER_ROLES_FOR } from 'common/authorization/roleBaseAccessControl';

import useAuthz from './useAuthz';

export default function useAllowedUserRoles() {
  const { checkUserRole } = useAuthz();
  const requiredRolesByView = REQUIRED_USER_ROLES_FOR.VIEWS;

  const allowViews = useMemo(
    () => ({
      operationalStudiesAllowed: checkUserRole(requiredRolesByView.OPERATIONAL_STUDIES),
      stdcmAllowed: checkUserRole(requiredRolesByView.STDCM),
      infraEditorAllowed: checkUserRole(requiredRolesByView.INFRA_EDITOR),
      rollingStockEditorAllowed: checkUserRole(requiredRolesByView.ROLLING_STOCK_EDITOR),
      mapAllowed: checkUserRole(requiredRolesByView.MAP),
    }),
    [checkUserRole]
  );

  return allowViews;
}
