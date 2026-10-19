import { useState, useMemo, useCallback } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';

import { useDebounce } from 'utils/hooks/useDebounce';

import type { SearchResultItemGroup, SearchResultItemUser } from './api/generatedEditoastApi';
import { osrdEditoastApi } from './api/osrdEditoastApi';
import { SUBJECT_TYPES } from './authorization/consts';
import type { SubjectType } from './authorization/types';

export type Subject = {
  id: number;
  type: SubjectType;
  name: string;
};

export const DEBOUNCE_DURATION = 150;

export default function useSearchSubjects(type: SubjectType[] = ['User', 'Group']) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<Set<SubjectType>>(new Set(type));

  const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_DURATION);

  const { data: searchedGroupsData } = osrdEditoastApi.endpoints.postSearch.useQuery(
    searchType.has('Group') && debouncedSearchTerm
      ? {
          searchPayload: {
            object: 'group',
            query: ['search', ['name'], debouncedSearchTerm],
          },
          pageSize: 101,
        }
      : skipToken
  );

  const { data: searchedUsersData } = osrdEditoastApi.endpoints.postSearch.useQuery(
    searchType.has('User') && debouncedSearchTerm
      ? {
          searchPayload: {
            object: 'user',
            query: ['search', ['name'], debouncedSearchTerm],
          },
          pageSize: 101,
        }
      : skipToken
  );

  const searchedSubjects = useMemo(() => {
    const searchResult: Subject[] = [];

    if (searchedGroupsData && searchType.has('Group'))
      searchResult.push(
        ...(searchedGroupsData as SearchResultItemGroup[]).map((result) => ({
          id: result.id,
          name: result.name,
          type: SUBJECT_TYPES.GROUP,
        }))
      );

    if (searchedUsersData && searchType.has('User'))
      searchResult.push(
        ...(searchedUsersData as SearchResultItemUser[]).map((result) => ({
          id: result.id,
          name: result.name,
          type: SUBJECT_TYPES.USER,
        }))
      );

    return searchResult;
  }, [searchedUsersData, searchedGroupsData, searchType]);

  const resetSearch = useCallback(() => {
    setSearchType(new Set(type));
    setSearchTerm('');
  }, [type]);

  return {
    resetSearch,
    searchedSubjects,
    setSearchTerm,
    setSearchType,
  };
}
