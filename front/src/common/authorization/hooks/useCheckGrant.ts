import { type Grant, type ResourceType } from 'common/api/mock/mockEditoastApi';

import useResourcePermissions from './useResourcePermissions';

const grantHierarchy: Record<Grant, number> = {
  NONE: 0,
  READER: 1,
  WRITER: 2,
  OWNER: 3,
};

export type GrantConfig = {
  resourceType: ResourceType;
  resourceId?: number;
  requiredGrant: Grant;
};

const useCheckGrant = ({ resourceType, resourceId, requiredGrant }: GrantConfig) => {
  const { userGrant } = useResourcePermissions(resourceType, resourceId);
  return grantHierarchy[userGrant] >= grantHierarchy[requiredGrant];
};

export default useCheckGrant;
