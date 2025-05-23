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

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<null | Error>(null);
  const [subjects, setSubjects] = useState<SubjectWithGrant[]>([]);

  /**
   * Fetches the user list for a given resource type and resource id.
   * @param pageNb the page number to fetch
   */
  const fetchPage = useCallback(
    async (pageNb: number) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchUserList({
          resourceType,
          resourceId: id,
          page: pageNb,
        }).unwrap();
        setSubjects((prev) => [...prev, ...response.subjects]);
        if (response.subjects.length === 0) setHasMore(false);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    },
    [resourceType, id, fetchUserList]
  );

  /**
   * When the resource changes
   */
  useEffect(() => {
    // reset state
    setHasMore(true);
    setPage(1);
    setError(null);
    setLoading(false);
    // load first page
    fetchPage(1);
  }, [resourceType, id, fetchPage]);

  /**
   * Fetch more function for the infinite scroll
   */
  const fetchMore = useCallback(() => {
    fetchPage(page + 1);
    setPage((prev) => prev + 1);
  }, [fetchPage, page]);

  /**
   * Fetch more function for the infinite scroll
   */
  const refetch = useCallback(async () => {
    setSubjects([]);
    await fetchPage(1);
    setPage(1);
  }, [fetchPage, page]);

  return { loading, error, subjects, fetchMore, refetch, hasMore };
}
