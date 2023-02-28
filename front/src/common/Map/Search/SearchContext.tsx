import React, { createContext, useContext, useState, Dispatch } from 'react';

type SearchContextType = {
  isSearchLine: boolean;
  setIsSearchLine: React.Dispatch<React.SetStateAction<boolean>> | undefined;
  lineSearch: any;
  setLineSearch: React.Dispatch<React.SetStateAction<any>> | undefined;
};

export const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const useSearchContext = () => useContext(SearchContext);

export const SearchProvider: React.FC = ({ children }) => {
  const [isSearchLine, setIsSearchLine] = useState<boolean>(false);
  const [lineSearch, setLineSearch] = useState<any | undefined>(undefined);

  return (
    <SearchContext.Provider value={{ isSearchLine, setIsSearchLine, lineSearch, setLineSearch }}>
      {children}
    </SearchContext.Provider>
  );
};
