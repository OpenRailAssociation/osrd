import { type Privilege, type ResourceType } from 'common/api/mock/mockEditoastApi';

import useResourcePermissions from './useResourcePermissions';

export type PrivilegeConfig = {
  resourceType: ResourceType;
  resourceId?: number;
  requiredPrivilege: Privilege;
};

const useCheckPrivilege = ({ resourceType, resourceId, requiredPrivilege }: PrivilegeConfig) => {
  const { userGrant, resourceGrants } = useResourcePermissions(resourceType, resourceId);
  if (userGrant === 'NONE' || !resourceGrants) {
    return false;
  }

  return resourceGrants[userGrant].includes(requiredPrivilege);
};

export default useCheckPrivilege;
