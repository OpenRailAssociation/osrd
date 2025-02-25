export type AuthorizationRequirement =
  | {
      requiredGrant: string;
      requiredPrivileges?: undefined;
    }
  | {
      requiredGrant?: undefined;
      requiredPrivileges: string[];
    };

export type CheckPrivilegesParams = {
  resourceGrants?: {
    [grant: string]: string[];
  };
  userGrant: string;
} & AuthorizationRequirement;

const checkPrivileges = ({
  userGrant,
  resourceGrants = {},
  requiredGrant,
  requiredPrivileges = [],
}: CheckPrivilegesParams) => {
  const userPrivileges = resourceGrants[userGrant] || [];
  const privilegesToCheck = requiredGrant
    ? resourceGrants[requiredGrant] || []
    : requiredPrivileges;

  return privilegesToCheck.every((privilege) => userPrivileges.includes(privilege));
};

export default checkPrivileges;
