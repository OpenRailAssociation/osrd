import { skipToken } from '@reduxjs/toolkit/query';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';

/**
 * Hook to retrieve an infra item by it's id.
 */
export default function useInfra(infraID?: number) {
  const { data, isLoading, error } = osrdEditoastApi.endpoints.getInfraByInfraId.useQuery(
    infraID ? { infraId: infraID } : skipToken
  );

  return { data, isLoading, error };
}

export function useCurrentInfra() {
  const infraID = useInfraID();
  return useInfra(infraID);
}
