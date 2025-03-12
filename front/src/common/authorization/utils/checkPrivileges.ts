export type authorizationRequirement =
  | {
      requiredGrant?: string;
      requiredPrivileges?: undefined;
    }
  | {
      requiredGrant?: undefined;
      requiredPrivileges?: string[];
    };

export type checkPrivilegesParams = {
  resourceGrants?: {
    [grant: string]: string[];
  };
  userGrant: string;
} & authorizationRequirement;

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
