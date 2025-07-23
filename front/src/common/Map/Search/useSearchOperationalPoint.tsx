import { useState, useEffect, useMemo, useCallback } from 'react';

import { useSelector } from 'react-redux';

import { type SearchResultItemOperationalPoint, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import { setFailure } from 'reducers/main';
import { getOperationalPoints } from 'reducers/osrdconf/stdcmConf/selectors';
import { getIsSuperUser } from 'reducers/user/userSelectors';
import { castErrorToFailure } from 'utils/error';
import { useDebounce } from 'utils/helpers';

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
  const [searchResults, setSearchResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const [mainOperationalPointsOnly, setMainOperationalPointsOnly] = useState(false);
  const stdcmOperationalPoints = useSelector(getOperationalPoints);
  const isSuperUser = useSelector(getIsSuperUser);

  const debouncedSearchTerm = useDebounce(searchTerm, debounceDelay);
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();

  const stdcmPerimeterOperationalpointsFilter = useMemo(() => {
    if (isStdcm && !isSuperUser && stdcmOperationalPoints) {
      return ['or', ...stdcmOperationalPoints.map((ci) => ['=', ['ci'], ci])];
    }
    return true;
  }, [stdcmOperationalPoints, isSuperUser, isStdcm]);

  /* Search for operational whose trigrams start with the search query */
  const searchOperationalPointsByTrigram = useCallback(
    async (searchQuery: string) => {
      const shouldSearchByTrigram = !Number.isInteger(+searchQuery) && searchQuery.length < 4;

      if (!shouldSearchByTrigram || !infraID) return [];

      const payload = {
        object: 'operationalpoint',
        query: [
          'and',
          ['ilike', ['trigram'], `${searchQuery}%`],
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
    [infraID, isStdcm, isSuperUser, stdcmPerimeterOperationalpointsFilter]
  );

  /** Search for operational points whose trigrams start with the search query or whose name or UIC code (primary code) contain the search query */
  const searchOperationalPoints = useCallback(
    async (searchQuery: string) => {
      if (infraID === undefined) return [];

      const sortedTrigramResults = await searchOperationalPointsByTrigram(searchQuery);
      const trigramResultsIds = new Set(sortedTrigramResults.map((op) => op.obj_id));

      try {
        const results = (await postSearch({
          searchPayload: {
            object: 'operationalpoint',
            query: [
              'and',
              [
                'or',
                ['search', ['name'], searchQuery],
                ['like', ['to_string', ['uic']], `%${searchQuery}%`],
              ],
              ['=', ['infra_id'], infraID],
              stdcmPerimeterOperationalpointsFilter,
            ],
          },
          pageSize,
        }).unwrap()) as SearchResultItemOperationalPoint[];
        const deduplicatedResults = results.filter((item) => !trigramResultsIds.has(item.obj_id));
        const sortedResults = [...deduplicatedResults];
        sortedResults.sort(sortOperationalPointsFromNameAndUicSearch(searchQuery));

        const allResults = [...sortedTrigramResults, ...sortedResults];
        return allResults;
      } catch (error) {
        setFailure(castErrorToFailure(error));
        return [];
      }
    },
    [infraID, isStdcm, isSuperUser, stdcmPerimeterOperationalpointsFilter]
  );

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

  useEffect(() => {
    if (debouncedSearchTerm) {
      searchOperationalPoints(debouncedSearchTerm).then((results) => {
        setSearchResults(results);
      });
    } else if (searchResults.length !== 0) {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm]);

  return {
    searchTerm,
    chCodeFilter,
    searchResultsFilteredByCh,
    mainOperationalPointsOnly,
    searchResults,
    searchOperationalPoints,
    searchOperationalPointsByTrigram,
    setSearchTerm,
    setChCodeFilter,
    setSearchResults,
    setMainOperationalPointsOnly,
  };
}
