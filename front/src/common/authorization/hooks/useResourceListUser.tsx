import { useCallback, useEffect, useState } from 'react';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

import type { ResourceType, SubjectWithGrant } from '../types';

/**
 * Hook to list subjects that have access to the given resource.
 * It return the user with their grants on the resource.
 * You can use this hook to implement an infinite scroll.
 */
export default function useResourceListSubjects(resourceType: ResourceType, id: number) {
  const [fetchUserList] =
    osrdEditoastApi.endpoints.getAuthzByResourceTypeAndResourceId.useLazyQuery();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<null | Error>(null);
  const [subjects, setSubjects] = useState<SubjectWithGrant[]>([]);

  /**
   * Fetches the user list for a given resource type and resource id.
   */
  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchUserList({
        resourceType,
        resourceId: id,
      }).unwrap();
      setSubjects(response);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [resourceType, id, fetchUserList]);

  /**
   * When the resource changes
   */
  useEffect(() => {
    // reset state
    setError(null);
    setLoading(false);
    fetchPage();
  }, [resourceType, id, fetchPage]);

  const refetch = useCallback(async () => {
    setSubjects([]);
    await fetchPage();
  }, [fetchPage]);

  return { loading, error, subjects, refetch };
}
