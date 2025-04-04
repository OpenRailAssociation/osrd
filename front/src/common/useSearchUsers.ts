import { useState, useCallback, useEffect } from 'react';

import { useDebounce } from 'utils/helpers';

import type { SearchResultItemUser } from './api/generatedEditoastApi';
import type { Grant, SubjectType } from './api/mock/mockEditoastApi';
import { osrdEditoastApi } from './api/osrdEditoastApi';
import { SUBJECT_TYPES } from './authorization/consts';

export type UserWithPendingGrant = {
  id: number;
  type: SubjectType;
  name: string;
  grant?: Grant;
}[];

export default function useSearchUsers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<UserWithPendingGrant>([]);

  const debouncedSearchTerm = useDebounce(searchTerm, 150);
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();

  const searchUser = useCallback(async (searchQuery: string) => {
    try {
      const results = (await postSearch({
        searchPayload: {
          object: 'user',
          query: ['search', ['name'], searchQuery],
        },
        pageSize: 101,
      }).unwrap()) as SearchResultItemUser[];

      return results.map((result) => ({
        id: result.id,
        name: result.name,
        type: SUBJECT_TYPES.USER,
      }));
    } catch (error) {
      console.error(error);
      return [];
    }
  }, []);

  const resetSuggestions = () => {
    setSearchedUsers([]);
    setSearchTerm('');
  };

  useEffect(() => {
    if (debouncedSearchTerm) {
      searchUser(debouncedSearchTerm).then((results) => {
        setSearchedUsers(results);
      });
    } else if (searchedUsers.length !== 0) {
      setSearchedUsers([]);
    }
  }, [debouncedSearchTerm]);

  return {
    resetSuggestions,
    searchedUsers,
    setSearchTerm,
  };
}
