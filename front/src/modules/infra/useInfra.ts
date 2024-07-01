import { useCallback, useEffect, useState } from 'react';

import { isNil } from 'lodash';

import type { Infra } from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';

/**
 * Hook to retrieve an infra item by it's id.
 * Using RTK `useLazyQuery` does the job but also produces a lot of queries due to its subscription mechanism for updating its cache.
 */
export default function useInfra(infraID?: number) {
  const [data, setData] = useState<Infra | null>(null);
  const [getInfra, { isLoading, error }] = osrdEditoastApi.endpoints.getInfraByInfraId.useLazyQuery(
    {}
  );

  const fetch = useCallback(
    async (infraId?: number) => {
      // reset
      setData(null);
      try {
        if (!isNil(infraId)) {
          const resp = getInfra({ infraId });
          const result = await resp.unwrap();
          setData(result || null);
          resp.unsubscribe();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [getInfra]
  );

  useEffect(() => {
    fetch(infraID);
  }, [infraID, fetch]);

  return { data, isLoading, error };
}

export function useCurrentInfra() {
  const infraID = useInfraID();
  return useInfra(infraID);
}
