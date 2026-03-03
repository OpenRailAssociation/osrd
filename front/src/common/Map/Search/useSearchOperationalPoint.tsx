import { useState, useMemo, useCallback } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { useSelector } from 'react-redux';

import { type SearchResultItemOperationalPoint, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import { setFailure } from 'reducers/main';
import { getOperationalPoints } from 'reducers/osrdconf/stdcmConf/selectors';
import { getIsSuperUser } from 'reducers/user/userSelectors';
import { castErrorToFailure } from 'utils/error';
import { useDebounce } from 'utils/hooks/useDebounce';

import { MAIN_OP_CH_CODES } from './consts';
import {
  sortOperationalPointsFromNameAndUicSearch,
  sortOperationalPointsFromTrigramSearch,
} from './sortOperationalPoints';

type SearchOperationalPoint = {
  debounceDelay?: number;
  initialSearchTerm?: string;
  initialChCodeFilter?: string;
  isStdcm?: boolean;
  pageSize?: number;
};

export default function useSearchOperationalPoint({
  debounceDelay = 150,
  initialSearchTerm = '',
  initialChCodeFilter,
  isStdcm = false,
  pageSize = 1000,
}: SearchOperationalPoint = {}) {
  const infraID = useInfraID();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [chCodeFilter, setChCodeFilter] = useState(initialChCodeFilter);
  const [mainOperationalPointsOnly, setMainOperationalPointsOnly] = useState(false);
  const stdcmOperationalPoints = useSelector(getOperationalPoints);
  const isSuperUser = useSelector(getIsSuperUser);

  const debouncedSearchTerm = useDebounce(searchTerm, debounceDelay);
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useLazyQuery();

  const stdcmPerimeterOperationalpointsFilter = useMemo(() => {
    if (isStdcm && !isSuperUser && stdcmOperationalPoints) {
      return ['or', ...stdcmOperationalPoints.map((ci) => ['=', ['ci'], ci])];
    }
    return true;
  }, [stdcmOperationalPoints, isSuperUser, isStdcm]);

  /* Lazily search for operational whose trigrams exactly match the search query */
  const lazySearchByExactTrigram = useCallback(
    async (searchQuery: string) => {
      if (!infraID) return [];

      const payload = {
        object: 'operationalpoint',
        query: [
          'and',
          ['=', ['trigram'], `${searchQuery}`],
          ['=', ['infra_id'], infraID],
          stdcmPerimeterOperationalpointsFilter,
        ],
      };
      try {
        const results = (await postSearch({
          searchPayload: payload,
          pageSize,
        }).unwrap()) as SearchResultItemOperationalPoint[];
        const sortedResults = [...results];
        sortedResults.sort(sortOperationalPointsFromTrigramSearch);
        return sortedResults;
      } catch (error) {
        setFailure(castErrorToFailure(error));
        return [];
      }
    },
    [infraID, stdcmPerimeterOperationalpointsFilter]
  );

  const shouldSearchByTrigram =
    infraID &&
    debouncedSearchTerm &&
    !Number.isInteger(+debouncedSearchTerm) &&
    debouncedSearchTerm.length < 4;

  /* Operational points whose trigrams start with the search query */
  const { data: rawTrigramResults } = osrdEditoastApi.endpoints.postSearch.useQuery(
    shouldSearchByTrigram
      ? {
          searchPayload: {
            object: 'operationalpoint',
            query: [
              'and',
              ['ilike', ['trigram'], `${debouncedSearchTerm}%`],
              ['=', ['infra_id'], infraID],
              stdcmPerimeterOperationalpointsFilter,
            ],
          },
          pageSize,
        }
      : skipToken
  );

  /* Operational points whose name or UIC code (primary code) contain the search query */
  const { data: rawNameAndUicResults } = osrdEditoastApi.endpoints.postSearch.useQuery(
    infraID && debouncedSearchTerm
      ? {
          searchPayload: {
            object: 'operationalpoint',
            query: [
              'and',
              [
                'or',
                ['search', ['name'], debouncedSearchTerm],
                ['like', ['to_string', ['uic']], `%${debouncedSearchTerm}%`],
              ],
              ['=', ['infra_id'], infraID],
              stdcmPerimeterOperationalpointsFilter,
            ],
          },
          pageSize,
        }
      : skipToken
  );

  const searchResults = useMemo(() => {
    if (!debouncedSearchTerm) return [];

    const trigramResults = [...((rawTrigramResults ?? []) as SearchResultItemOperationalPoint[])];
    trigramResults.sort(sortOperationalPointsFromTrigramSearch);
    const trigramResultsIds = new Set(trigramResults.map((op) => op.obj_id));

    const nameAndUicResults = [
      ...((rawNameAndUicResults ?? []) as SearchResultItemOperationalPoint[]),
    ];
    const dedupNameAndUicResults = nameAndUicResults.filter(
      (item) => !trigramResultsIds.has(item.obj_id)
    );
    dedupNameAndUicResults.sort(sortOperationalPointsFromNameAndUicSearch(debouncedSearchTerm));

    const allResults = [...trigramResults, ...dedupNameAndUicResults];
    return allResults;
  }, [debouncedSearchTerm, rawTrigramResults, rawNameAndUicResults]);

  /** Filter operational points on secondary code (ch), if provided */
  const searchResultsFilteredByCh = useMemo(() => {
    if (
      mainOperationalPointsOnly ||
      (chCodeFilter !== undefined && MAIN_OP_CH_CODES.includes(chCodeFilter))
    )
      return searchResults.filter((result) => MAIN_OP_CH_CODES.includes(result.ch));

    if (!chCodeFilter) return searchResults;

    const chFilter = chCodeFilter.trim().toLowerCase();
    return searchResults.filter((result) => result.ch.toLocaleLowerCase().includes(chFilter));
  }, [searchResults, chCodeFilter, mainOperationalPointsOnly]);

  return {
    searchTerm,
    chCodeFilter,
    searchResultsFilteredByCh,
    mainOperationalPointsOnly,
    searchResults,
    searchOperationalPointsByTrigram: lazySearchByExactTrigram,
    setSearchTerm,
    setChCodeFilter,
    setMainOperationalPointsOnly,
  };
}
