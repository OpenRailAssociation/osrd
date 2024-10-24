import { useSelector } from 'react-redux';

import type { BuiltinRole } from 'common/api/osrdEditoastApi';
import { getIsSuperUser, getUserRoles } from 'reducers/user/userSelectors';

const useUserRoleCheck = (allowedRoles: BuiltinRole[]) => {
  const isSuperUser = useSelector(getIsSuperUser);
  const userRoles = useSelector(getUserRoles);

  if (allowedRoles.length === 0 || isSuperUser) {
    return true;
  }
  return allowedRoles.some((role) => userRoles.includes(role));
};

export default useUserRoleCheck;
