import React, { createContext, useContext, useMemo, useState } from 'react';

type SearchContextType = {
  isSearchLine: boolean;
  setIsSearchLine: React.Dispatch<React.SetStateAction<boolean>>;
  lineSearch: any;
  setLineSearch: React.Dispatch<React.SetStateAction<any>>;
};

export const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const useSearchContext = () => useContext(SearchContext);

export const SearchProvider: React.FC = ({ children }) => {
  const [isSearchLine, setIsSearchLine] = useState<boolean>(false);
  const [lineSearch, setLineSearch] = useState<any>(undefined);

  const searchValueContext = useMemo(
    () => ({
      isSearchLine,
      setIsSearchLine,
      lineSearch,
      setLineSearch,
    }),
    [isSearchLine, lineSearch]
  );

  return <SearchContext.Provider value={searchValueContext}>{children}</SearchContext.Provider>;
};
