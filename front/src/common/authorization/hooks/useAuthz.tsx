import { useCallback } from 'react';

import { useSelector } from 'react-redux';

import { osrdEditoastApi, type Role } from 'common/api/osrdEditoastApi';
import { getIsSuperUser, getUserRoles, getUserId } from 'reducers/user/userSelectors';

import type { Grant, Privilege, ResourceType } from '../types';

/**
 * Hook to manage authorization.
 */
export default function useAuthz() {
  const userId = useSelector(getUserId);
  const isSuperUser = useSelector(getIsSuperUser);
  const userRoles = useSelector(getUserRoles);
  const [updateSubjectGrantApi] = osrdEditoastApi.endpoints.postAuthzGrants.useMutation();
  const [retrieveUserGrants] = osrdEditoastApi.endpoints.postAuthzMeGrants.useMutation();
  const [retrieveUserPrivileges] = osrdEditoastApi.endpoints.postAuthzMePrivileges.useMutation();

  /**
   *  Check if the connected user has one of the specified roles.
   */
  const checkUserRole = useCallback(
    (roles: Role[]) => {
      if (roles.length === 0 || isSuperUser) {
        return true;
      }
      return roles.some((role) => userRoles.includes(role));
    },
    [isSuperUser, userRoles]
  );

  /**
   * Function to update the grant of a subject on a resource.
   */
  const updateGrant = useCallback(
    async (resourceType: ResourceType, resourceId: number, subjectId: number, grant?: Grant) => {
      const basePayload = {
        resource_type: resourceType,
        resource_id: resourceId,
        subject_id: subjectId,
      };
      await updateSubjectGrantApi({
        body: grant ? { grant: [{ ...basePayload, grant }] } : { revoke: [basePayload] },
      });
    },
    []
  );

  /**
   * Retrieve grants of the connected user for a list of resources.
   */
  const getUserGrants = useCallback(
    async (resources: Record<ResourceType, number[]>) => {
      const result = await retrieveUserGrants({ body: resources }).unwrap();
      return Object.keys(result).reduce(
        (accByType, resourceType) => {
          accByType[resourceType as ResourceType] = result[resourceType].reduce(
            (accById, item) => {
              accById[item.id] = item.grant;
              return accById;
            },
            {} as { [key: number]: Grant }
          );
          return accByType;
        },
        {} as Record<ResourceType, { [id: number]: Grant }>
      );
    },
    [retrieveUserGrants]
  );

  /**
   * Retrieve privileges of the connected user for a list of resources.
   */
  const getUserPrivileges = useCallback(
    async (resources: Record<ResourceType, number[]>) => {
      const result = await retrieveUserPrivileges({ body: resources }).unwrap();
      return Object.keys(result).reduce(
        (accByType, resourceType) => {
          accByType[resourceType as ResourceType] = result[resourceType].reduce(
            (accById, item) => {
              accById[item.resource_id] = new Set(item.privileges);
              return accById;
            },
            {} as { [key: number]: Set<Privilege> }
          );
          return accByType;
        },
        {} as Record<ResourceType, { [id: number]: Set<Privilege> }>
      );
    },
    [retrieveUserPrivileges]
  );

  /**
   *  Check if the connected user has the specified privileges.
   */
  const checkUserPrivileges = useCallback(
    async (resourceType: ResourceType, resourceId: number, privileges: Privilege[]) => {
      const result = await getUserPrivileges({ [resourceType]: [resourceId] });
      const userPrivileges = result[resourceType] ? result[resourceType][resourceId] : new Set();
      return privileges.every((privilege) => userPrivileges.has(privilege));
    },
    [getUserPrivileges]
  );

  return {
    userId,
    isSuperUser,
    userRoles,
    updateGrant,
    getUserGrants,
    checkUserRole,
    getUserPrivileges,
    checkUserPrivileges,
  };
}
