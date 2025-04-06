import { useState, useCallback, useEffect } from 'react';

import { DEFAULT_GRANT } from 'modules/infra/consts';
import { useDebounce } from 'utils/helpers';

import type { SearchResultItemUser } from './api/generatedEditoastApi';
import type { SubjectItemWithGrant } from './api/mock/mockEditoastApi';
import { osrdEditoastApi } from './api/osrdEditoastApi';

type SearchUser = {
  debounceDelay?: number;
  initialSearchTerm?: string;
};

export default function useSearchUser({
  debounceDelay = 150,
  initialSearchTerm = '',
}: SearchUser = {}) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [searchResults, setSearchResults] = useState<SubjectItemWithGrant>([]);

  const debouncedSearchTerm = useDebounce(searchTerm, debounceDelay);
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

      const formattedResults = results.map((result) => ({
        id: result.id,
        name: result.name,
        grant: DEFAULT_GRANT,
        type: 'user',
      }));

      return formattedResults;
    } catch (error) {
      console.error(error);
      return [];
    }
  }, []);

  useEffect(() => {
    if (debouncedSearchTerm) {
      searchUser(debouncedSearchTerm).then((results) => {
        setSearchResults(results);
      });
    } else if (searchResults.length !== 0) {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm]);

  return {
    searchTerm,
    searchResults,
    searchUser,
    setSearchTerm,
    setSearchResults,
  };
}
