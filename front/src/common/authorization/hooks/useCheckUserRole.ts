import { useMemo } from 'react';

import type { Role } from 'common/api/osrdEditoastApi';

import useAuthz from './useAuthz';

/**
 *
 * Hook to check if the connected user has one of the specified roles.
 */
export default function useCheckUserRole(roles: Role[]) {
  const { checkUserRole } = useAuthz();

  const hasRole = useMemo(() => checkUserRole(roles), [checkUserRole, JSON.stringify(roles)]);

  return hasRole;
}
