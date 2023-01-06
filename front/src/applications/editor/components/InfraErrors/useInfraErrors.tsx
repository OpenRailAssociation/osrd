import { useState, useCallback } from 'react';
import { isNil, toPairs } from 'lodash';

import { get } from '../../../../common/requests';
import { InfraErrorLevel, InfraErrorType, InfraError } from './types';

/**
 * API parameters type.
 */
interface ApiParams {
  page?: number;
  error_type?: InfraErrorType;
  level?: InfraErrorLevel;
}

/**
 * API response type.
 */
interface ApiResponse {
  count: number;
  next: number | null;
  previous: number | null;
  results: Array<InfraError>;
}

/**
 * Lazy API hook to retrieve errors for an infra.
 */
function useInfraErrors(): {
  loading: boolean;
  next: number | null;
  total: number | null;
  error: Error | null;
  fetch: (infra: number, opts: ApiParams) => Promise<Array<InfraError> | null>;
} {
  // return state
  const [total, setTotal] = useState<number | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async (infra: number, params: ApiParams = {}) => {
    setLoading(true);
    setError(null);
    setTotal(null);
    try {
      const args = toPairs(params)
        .filter((e) => !isNil(e[1]))
        .map((e) => `${encodeURIComponent(e[0])}=${encodeURIComponent(e[1])}`)
        .join('&');
      const result = await get<ApiResponse>(`/editoast/infra/${infra}/errors/?${args}`);
      setTotal(result.count);
      setNext(result.next);
      return result.results;
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, next, total, fetch };
}

export default useInfraErrors;
