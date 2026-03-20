import { useState, useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';

import { useDebounce } from 'utils/hooks/useDebounce';

import type { SearchResultItemUser } from './api/generatedEditoastApi';
import { osrdEditoastApi } from './api/osrdEditoastApi';
import { SUBJECT_TYPES } from './authorization/consts';
import type { SubjectType } from './authorization/types';

export type User = {
  id: number;
  type: SubjectType;
  name: string;
};

export const DEBOUNCE_DURATION = 150;

export default function useSearchUsers() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_DURATION);

  const { data: searchedUsersData } = osrdEditoastApi.endpoints.postSearch.useQuery(
    debouncedSearchTerm
      ? {
          searchPayload: {
            object: 'user',
            query: ['search', ['name'], debouncedSearchTerm],
          },
          pageSize: 101,
        }
      : skipToken
  );

  const searchedUsers = useMemo(
    () =>
      ((searchedUsersData ?? []) as SearchResultItemUser[]).map((result) => ({
        id: result.id,
        name: result.name,
        type: SUBJECT_TYPES.USER,
      })),
    [searchedUsersData]
  );

  const resetSuggestions = () => {
    setSearchTerm('');
  };

  return {
    resetSuggestions,
    searchedUsers,
    setSearchTerm,
  };
}
