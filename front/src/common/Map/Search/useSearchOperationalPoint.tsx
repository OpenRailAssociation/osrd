import { useState, useEffect, useMemo } from 'react';

import { isEmpty } from 'lodash';

import { type SearchResultItemOperationalPoint, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import { useDebounce } from 'utils/helpers';

export const MAIN_OP_CH_CODES = ['', '00', 'BV'];

type SearchOperationalPoint = {
  debounceDelay?: number;
  initialSearchTerm?: string;
  initialChCodeFilter?: string;
};

export default function useSearchOperationalPoint({
  debounceDelay = 150,
  initialSearchTerm = '',
  initialChCodeFilter,
}: SearchOperationalPoint = {}) {
  const infraID = useInfraID();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [chCodeFilter, setChCodeFilter] = useState(initialChCodeFilter);
  const [searchResults, setSearchResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const [mainOperationalPointsOnly, setMainOperationalPointsOnly] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, debounceDelay);
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();

  const searchOperationalPoints = async () => {
    const isSearchingByTrigram =
      !Number.isInteger(+debouncedSearchTerm) && debouncedSearchTerm.length < 4;
    const searchQuery = isSearchingByTrigram
      ? // We have to test for op names that goes under 4 letters too
        ['or', ['=i', ['trigram'], debouncedSearchTerm], ['search', ['name'], debouncedSearchTerm]]
      : [
          'or',
          ['search', ['name'], debouncedSearchTerm],
          ['like', ['to_string', ['uic']], `%${debouncedSearchTerm}%`],
        ];
    const payload = {
      object: 'operationalpoint',
      query: ['and', searchQuery, infraID !== undefined ? ['=', ['infra_id'], infraID] : true],
    };

    try {
      const results = await postSearch({
        searchPayload: payload,
        pageSize: 101,
      }).unwrap();
      setSearchResults(results as SearchResultItemOperationalPoint[]);
    } catch (error) {
      setSearchResults([]);
    }
  };

  const sortByMainOperationalPoints = (
    a: SearchResultItemOperationalPoint,
    b: SearchResultItemOperationalPoint
  ) => {
    const nameComparison = a.name.localeCompare(b.name);
    if (nameComparison !== 0) {
      return nameComparison;
    }
    if (MAIN_OP_CH_CODES.includes(a.ch)) {
      return -1;
    }
    if (MAIN_OP_CH_CODES.includes(b.ch)) {
      return 1;
    }
    return a.ch.localeCompare(b.ch);
  };

  const sortedSearchResults = useMemo(
    () => [...searchResults].sort(sortByMainOperationalPoints),
    [searchResults]
  );

  const filteredAndSortedSearchResults = useMemo(
    () =>
      sortedSearchResults.filter((result) => {
        if (mainOperationalPointsOnly || (chCodeFilter && MAIN_OP_CH_CODES.includes(chCodeFilter)))
          return MAIN_OP_CH_CODES.includes(result.ch);

        if (chCodeFilter === undefined) return true;

        return result.ch.toLocaleLowerCase().includes(chCodeFilter.trim().toLowerCase());
      }),
    [sortedSearchResults, chCodeFilter, mainOperationalPointsOnly]
  );

  useEffect(() => {
    if (debouncedSearchTerm) {
      searchOperationalPoints();
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
    sortedSearchResults,
    filteredAndSortedSearchResults,
    mainOperationalPointsOnly,
    searchResults,
    searchOperationalPoints,
    setSearchTerm,
    setChCodeFilter,
    setSearchResults,
    setMainOperationalPointsOnly,
  };
}
