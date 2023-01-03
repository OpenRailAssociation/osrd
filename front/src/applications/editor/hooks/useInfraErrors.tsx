import { useEffect, useState, useCallback } from 'react';
import { toPairs } from 'lodash';

import { get, post } from '../../../common/requests';

type ErrorLevel = 'errors' | 'warnings' | 'all';
type ErrorType =
  | 'invalid_reference'
  | 'out_of_range'
  | 'empty_path'
  | 'path_does_not_match_endpoints'
  | 'unknown_port_name'
  | 'invalid_switch_ports'
  | 'empty_object'
  | 'object_out_of_path'
  | 'missing_route'
  | 'unused_port'
  | 'duplicated_group'
  | 'no_buffer_stop'
  | 'path_is_not_continuous'
  | 'overlapping_switches'
  | 'overlapping_track_links';

interface ApiParams {
  page?: number;
  error_type?: ErrorType;
  level?: ErrorLevel;
}

export interface ApiResultItem {
  information: {
    error_type: ErrorType;
    field: string;
    is_warning: boolean;
    obj_id: string;
    obj_type: string;
  };
}

interface ApiResponse {
  count: number;
  next: number | null;
  previous: number | null;
  results: Array<ApiResultItem>;
}

/**
 * API hook to retrieve errors fro an infra.
 */
export function useInfraErrors(
  infraID: number,
  apiParams?: ApiParams
): {
  loading: boolean;
  hasNext: boolean;
  total: number | null;
  error: Error | null;
  data: Array<ApiResultItem> | null;
  fetch: (opts?: ApiParams) => Promise<Array<ApiResultItem> | null>;
} {
  // return state
  const [data, setData] = useState<null | Array<ApiResultItem>>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const [infra] = useState(infraID);
  const [params] = useState(apiParams);

  const fetch = useCallback(
    async (opts?: ApiParams) => {
      setLoading(true);
      setData(null);
      setError(null);
      setTotal(null);
      try {
        const args = toPairs({ ...params, ...opts })
          .map((e) => `${encodeURIComponent(e[0])}=${encodeURIComponent(e[1])}`)
          .join('&');
        const result = await get<ApiResponse>(`/editoast/infra/${infra}/errors/?${args}`);
        setData(result.results);
        setTotal(result.count);
        setHasNext(result.next ? true : false);
        return data;
      } catch (e) {
        setError(e as Error);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [infra, params]
  );

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { loading, error, data, fetch, hasNext, total };
}
