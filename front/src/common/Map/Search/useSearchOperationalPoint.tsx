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
  sortOperationalPointsFromMainCodeSearch,
} from './sortOperationalPoints';

type SearchOperationalPoint = {
  debounceDelay?: number;
  initialSearchTerm?: string;
  initialSecondaryCodeFilter?: string | null;
  isStdcm?: boolean;
  pageSize?: number;
};

export default function useSearchOperationalPoint({
  debounceDelay = 150,
  initialSearchTerm = '',
  initialSecondaryCodeFilter,
  isStdcm = false,
  pageSize = 1000,
}: SearchOperationalPoint = {}) {
  const infraID = useInfraID();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [secondaryCodeFilter, setSecondaryCodeFilter] = useState(initialSecondaryCodeFilter);
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

  /* Lazily search for operational whose main code exactly match the search query */
  const lazySearchByExactMainCode = useCallback(
    async (searchQuery: string) => {
      if (!infraID) return [];

      const payload = {
        object: 'operationalpoint',
        query: [
          'and',
          ['=', ['main_code'], `${searchQuery}`],
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
        sortedResults.sort(sortOperationalPointsFromMainCodeSearch);
        return sortedResults;
      } catch (error) {
        setFailure(castErrorToFailure(error));
        return [];
      }
    },
    [infraID, stdcmPerimeterOperationalpointsFilter]
  );

  const shouldSearchByMainCode =
    infraID &&
    debouncedSearchTerm &&
    !Number.isInteger(+debouncedSearchTerm) &&
    debouncedSearchTerm.length < 4;

  /* Operational points whose trigrams start with the search query */
  const { data: rawMainCodeResults } = osrdEditoastApi.endpoints.postSearch.useQuery(
    shouldSearchByMainCode
      ? {
          searchPayload: {
            object: 'operationalpoint',
            query: [
              'and',
              ['ilike', ['main_code'], `${debouncedSearchTerm}%`],
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

    const mainCodeResults = [...((rawMainCodeResults ?? []) as SearchResultItemOperationalPoint[])];
    mainCodeResults.sort(sortOperationalPointsFromMainCodeSearch);
    const trigramResultsIds = new Set(mainCodeResults.map((op) => op.obj_id));

    const nameAndUicResults = [
      ...((rawNameAndUicResults ?? []) as SearchResultItemOperationalPoint[]),
    ];
    const dedupNameAndUicResults = nameAndUicResults.filter(
      (item) => !trigramResultsIds.has(item.obj_id)
    );
    dedupNameAndUicResults.sort(sortOperationalPointsFromNameAndUicSearch(debouncedSearchTerm));

    const allResults = [...mainCodeResults, ...dedupNameAndUicResults];
    return allResults;
  }, [debouncedSearchTerm, rawMainCodeResults, rawNameAndUicResults]);

  /** Filter operational points on secondary code, if provided */
  const searchResultsFilteredBySecondaryCode = useMemo(() => {
    if (
      mainOperationalPointsOnly ||
      (secondaryCodeFilter && MAIN_OP_CH_CODES.includes(secondaryCodeFilter))
    )
      return searchResults.filter((result) => result.is_passenger_station);

    if (!secondaryCodeFilter) return searchResults;

    const normalizedSecondaryCodeFilter = secondaryCodeFilter.trim().toLowerCase();
    return searchResults.filter(
      (result) =>
        result.secondary_code &&
        result.secondary_code.toLocaleLowerCase().includes(normalizedSecondaryCodeFilter)
    );
  }, [searchResults, secondaryCodeFilter, mainOperationalPointsOnly]);

  return {
    searchTerm,
    secondaryCodeFilter,
    searchResultsFilteredBySecondaryCode,
    mainOperationalPointsOnly,
    searchResults,
    searchOperationalPointsByMainCode: lazySearchByExactMainCode,
    setSearchTerm,
    setSecondaryCodeFilter,
    setMainOperationalPointsOnly,
  };
}
