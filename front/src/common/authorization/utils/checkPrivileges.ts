import type { Grant, Privilege, PrivilegesByGrant } from 'common/api/mock/mockEditoastApi';

export type AuthorizationRequirement =
  | {
      requiredGrant: Grant;
      requiredPrivileges?: undefined;
    }
  | {
      requiredGrant?: undefined;
      requiredPrivileges: Privilege[];
    };

export type CheckPrivilegesParams = {
  privilegesByGrant?: PrivilegesByGrant;
  userGrant: Grant;
} & AuthorizationRequirement;

const checkPrivileges = ({
  userGrant,
  privilegesByGrant = {
    READER: [],
    WRITER: [],
    OWNER: [],
  },
  requiredGrant,
  requiredPrivileges = [],
}: CheckPrivilegesParams) => {
  const userPrivileges = privilegesByGrant[userGrant] || [];
  const privilegesToCheck = requiredGrant
    ? privilegesByGrant[requiredGrant] || []
    : requiredPrivileges;

  return privilegesToCheck.every((privilege) => userPrivileges.includes(privilege));
};

export default checkPrivileges;
