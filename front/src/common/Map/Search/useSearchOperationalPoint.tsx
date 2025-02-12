import { useState, useEffect, useMemo, useCallback } from 'react';

import { isEmpty } from 'lodash';
import { useSelector } from 'react-redux';

import DPY_TO_MAS_OPERATIONAL_POINTS from 'assets/operationStudies/DPYToMASOperationalPoints';
import { type SearchResultItemOperationalPoint, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import { setFailure } from 'reducers/main';
import { getIsSuperUser } from 'reducers/user/userSelectors';
import { castErrorToFailure } from 'utils/error';
import { useDebounce } from 'utils/helpers';

export const MAIN_OP_CH_CODES = ['', '00', 'BV'];
const DPY_TO_MAS_FILTER = [
  'or',
  ...DPY_TO_MAS_OPERATIONAL_POINTS.map(([ci, ch]) => ['and', ['=', ['ci'], ci], ['=', ['ch'], ch]]),
];

type SearchOperationalPoint = {
  debounceDelay?: number;
  initialSearchTerm?: string;
  initialChCodeFilter?: string;
  isStdcm?: boolean;
};

export default function useSearchOperationalPoint({
  debounceDelay = 150,
  initialSearchTerm = '',
  initialChCodeFilter,
  isStdcm = false,
}: SearchOperationalPoint = {}) {
  const infraID = useInfraID();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [chCodeFilter, setChCodeFilter] = useState(initialChCodeFilter);
  const [searchResults, setSearchResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const [mainOperationalPointsOnly, setMainOperationalPointsOnly] = useState(false);
  const isSuperUser = useSelector(getIsSuperUser);

  const debouncedSearchTerm = useDebounce(searchTerm, debounceDelay);
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();

  const sortOperationalPoints =
    (searchQuery: string) =>
    (a: SearchResultItemOperationalPoint, b: SearchResultItemOperationalPoint) => {
      const upperCaseSearchTerm = searchQuery.toUpperCase();
      const lowerCaseSearchTerm = searchQuery.toLowerCase();

      // ops with trigram match first
      if (a.trigram === upperCaseSearchTerm && b.trigram !== upperCaseSearchTerm) {
        return -1;
      }
      if (b.trigram === upperCaseSearchTerm && a.trigram !== upperCaseSearchTerm) {
        return 1;
      }

      // ops whose name starts by the searchTerm
      const aStartsWithSearchTerm = a.name.toLowerCase().startsWith(lowerCaseSearchTerm);
      const bStartsWithSearchTerm = b.name.toLowerCase().startsWith(lowerCaseSearchTerm);

      if (aStartsWithSearchTerm && !bStartsWithSearchTerm) {
        return -1;
      }
      if (!aStartsWithSearchTerm && bStartsWithSearchTerm) {
        return 1;
      }

      // other matching ops alphabetically ordered
      const nameComparison = a.name.localeCompare(b.name);
      if (nameComparison !== 0) {
        return nameComparison;
      }

      const chA = a.ch ?? '';
      const chB = b.ch ?? '';

      if (MAIN_OP_CH_CODES.includes(chA)) {
        return -1;
      }
      if (MAIN_OP_CH_CODES.includes(chB)) {
        return 1;
      }
      return chA.localeCompare(chB);
    };

  const searchOperationalPointsByTrigram = useCallback(
    async (searchQuery: string) => {
      const shouldSearchByTrigram = !Number.isInteger(+searchQuery) && searchQuery.length < 4;

      if (!shouldSearchByTrigram || !infraID) return [];

      const dpyToMasOperationalpointsFilter = isStdcm && !isSuperUser ? DPY_TO_MAS_FILTER : true;

      const payload = {
        object: 'operationalpoint',
        query: [
          'and',
          ['=i', ['trigram'], searchQuery],
          ['=', ['infra_id'], infraID],
          dpyToMasOperationalpointsFilter,
        ],
      };
      try {
        const results = (await postSearch({
          searchPayload: payload,
          pageSize: 101,
        }).unwrap()) as SearchResultItemOperationalPoint[];
        const sortedResults = [...results];
        sortedResults.sort(sortOperationalPoints(searchQuery));
        return sortedResults;
      } catch (error) {
        setFailure(castErrorToFailure(error));
        return [];
      }
    },
    [infraID, isStdcm, isSuperUser]
  );

  /** Search for operational points by name or UIC code (primary code) */
  const searchOperationalPoints = useCallback(
    async (searchQuery: string) => {
      if (infraID === undefined) return [];

      const trigramResults = await searchOperationalPointsByTrigram(searchQuery);

      const dpyToMasOperationalpointsFilter = isStdcm && !isSuperUser ? DPY_TO_MAS_FILTER : true;

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
              dpyToMasOperationalpointsFilter,
            ],
          },
          pageSize: 101,
        }).unwrap()) as SearchResultItemOperationalPoint[];

        const allResults = [...trigramResults, ...results];
        allResults.sort(sortOperationalPoints(searchQuery));
        return allResults;
      } catch (error) {
        setFailure(castErrorToFailure(error));
        return [];
      }
    },
    [infraID, isStdcm, isSuperUser]
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

  useEffect(() => {
    if (isEmpty(searchResults)) setChCodeFilter(undefined);
  }, [searchResults]);

  return {
    searchTerm,
    chCodeFilter,
    searchResultsFilteredByCh,
    mainOperationalPointsOnly,
    searchResults,
    searchOperationalPoints,
    setSearchTerm,
    setChCodeFilter,
    setSearchResults,
    setMainOperationalPointsOnly,
  };
}
