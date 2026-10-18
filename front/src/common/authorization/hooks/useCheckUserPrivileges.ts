import { useEffect, useEffectEvent, useState } from 'react';

import type { Privilege, ResourceType } from '../types';
import useAuthz from './useAuthz';

type UseCheckUserPrivilegesParams = {
  resourceType: ResourceType;
  resourceId?: number;
  privileges: Privilege[];
};

/**
 *
 * Hook to check if the connected user has the specified privileges.
 */
export default function useCheckUserPrivileges({
  resourceType,
  resourceId,
  privileges,
}: UseCheckUserPrivilegesParams) {
  const { checkUserPrivileges } = useAuthz();
  const [hasPrivileges, setHasPrivileges] = useState(false);

  const onResourceChange = useEffectEvent((type: ResourceType, id: number) => {
    checkUserPrivileges(type, id, privileges)
      .then((result) => setHasPrivileges(result))
      .catch((error) => {
        console.error('Error checking user privileges:', error);
        setHasPrivileges(false);
      });
  });

  useEffect(() => {
    if (!resourceId) setHasPrivileges(false);
    else {
      onResourceChange(resourceType, resourceId);
    }
    /* oxlint-disable-next-line react/exhaustive-effect-dependencies */
  }, [checkUserPrivileges, resourceType, resourceId]);

  return hasPrivileges;
}
