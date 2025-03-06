import { type ResourceType } from 'common/api/mock/mockEditoastApi';

//
type checkPrivilegesParams = {
  resourceGrants?: {
    [grant: string]: string[];
  };
  resourceType: ResourceType;
  userGrant: string;
} & (
  | {
      requiredGrant?: string;
      requiredPrivileges?: undefined;
    }
  | {
      requiredGrant?: undefined;
      requiredPrivileges?: string[];
    }
);

const checkPrivileges = ({
  resourceGrants = {},
  requiredGrant,
  requiredPrivileges = [],
  userGrant,
}: checkPrivilegesParams) => {
  const userPrivileges = resourceGrants[userGrant] || [];
  const privilegesToCheck = requiredGrant
    ? resourceGrants[requiredGrant] || []
    : requiredPrivileges;

  return privilegesToCheck.every((privilege) => userPrivileges.includes(privilege));
};

export default checkPrivileges;
