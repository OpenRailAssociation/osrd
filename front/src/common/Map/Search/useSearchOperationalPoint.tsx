import { useState, useEffect, useMemo } from 'react';

import { isEmpty } from 'lodash';
import { useSelector } from 'react-redux';

import DPY_TO_MAS_OPERATIONAL_POINTS from 'assets/operationStudies/DPYToMASOperationalPoints';
import {
  type SearchQuery,
  type SearchResultItemOperationalPoint,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
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

  const searchOperationalPointsByTrigram = async (
    infraId: number,
    dpyToMasOperationalpointsFilter: SearchQuery
  ) => {
    const shouldSearchByTrigram =
      !Number.isInteger(+debouncedSearchTerm) && debouncedSearchTerm.length < 4;

    if (!shouldSearchByTrigram) return [];

    const payload = {
      object: 'operationalpoint',
      query: [
        'and',
        ['=i', ['trigram'], debouncedSearchTerm],
        ['=', ['infra_id'], infraId],
        dpyToMasOperationalpointsFilter,
      ],
    };
    try {
      const results = (await postSearch({
        searchPayload: payload,
        pageSize: 101,
      }).unwrap()) as SearchResultItemOperationalPoint[];
      return results;
    } catch (error) {
      setFailure(castErrorToFailure(error));
      return [];
    }
  };

  const searchOperationalPoints = async () => {
    if (infraID === undefined) return;

    const dpyToMasOperationalpointsFilter = isStdcm && !isSuperUser ? DPY_TO_MAS_FILTER : true;

    const trigramResults = await searchOperationalPointsByTrigram(
      infraID,
      dpyToMasOperationalpointsFilter
    );

    try {
      const results = (await postSearch({
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
            dpyToMasOperationalpointsFilter,
          ],
        },
        pageSize: 101,
      }).unwrap()) as SearchResultItemOperationalPoint[];
      setSearchResults([...trigramResults, ...results]);
    } catch (error) {
      setFailure(castErrorToFailure(error));
      setSearchResults([]);
    }
  };

  const sortOperationalPoints = (
    a: SearchResultItemOperationalPoint,
    b: SearchResultItemOperationalPoint
  ) => {
    const upperCaseSearchTerm = debouncedSearchTerm.toUpperCase();
    const lowerCaseSearchTerm = debouncedSearchTerm.toLowerCase();

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

  const sortedSearchResults = useMemo(
    () => [...searchResults].sort(sortOperationalPoints),
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
