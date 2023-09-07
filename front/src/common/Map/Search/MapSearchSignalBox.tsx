import React, { FC, useState, useEffect, useCallback } from 'react';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { get } from 'common/requests';
import { useDebounce } from 'utils/helpers';

const searchURI = '/gaia/osrd/signalbox/'; // '/matgaia/search_station';
type SearchParams = { q?: string; linecode?: string };
type SearchResult = {
  results: Array<{ name: string; linecode: string; stationname: string }>;
};
const MapSearchSignalBox: FC<unknown> = () => {
  const { t } = useTranslation(['translation', 'map-search']);
  const [searchState, setSearch] = useState('');
  const [searchLineState, setSearchLine] = useState('');
  const [dontSearch, setDontSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | undefined>(undefined);

  const debouncedSearchTerm = useDebounce(searchState, 300);
  const debouncedSearchLine = useDebounce(searchLineState, 300);

  const updateSearch = useCallback(async (params: SearchParams) => {
    const data = await get<SearchResult>(searchURI, { params });
    setSearchResults(data);
  }, []);

  const onResultClick = useCallback((result: { name: string }) => {
    setDontSearch(true);
    setSearch(result.name);
    setSearchResults(undefined);
  }, []);

  useEffect(() => {
    if (!dontSearch && (debouncedSearchTerm || debouncedSearchLine)) {
      const params: SearchParams = {};
      if (searchState !== '') {
        params.q = searchState;
      }
      if (searchLineState !== '') {
        params.linecode = searchLineState;
      }
      updateSearch(params);
    }
  }, [debouncedSearchTerm, debouncedSearchLine]);

  const formatSearchResults = () => {
    const searchResultsContent = searchResults?.results.sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    return searchResultsContent?.map((result) => (
      <button
        type="button"
        className="search-result-item"
        key={nextId()}
        onClick={() => onResultClick(result)}
      >
        {`${result.stationname} (${result.linecode})- ${result.name}`}
      </button>
    ));
  };

  return (
    <>
      <div className="d-flex">
        <span className="flex-grow-1 mr-2">
          <InputSNCF
            type="text"
            placeholder={t('map-search:placeholdername')}
            id="map-search-signalbox"
            onChange={(e) => {
              setSearch(e.target.value);
              setDontSearch(false);
            }}
            onClear={() => {
              setSearch('');
              setSearchResults(undefined);
            }}
            value={searchState}
            clearButton
            noMargin
            sm
          />
          <InputSNCF
            type="text"
            placeholder={t('map-search:placeholderline')}
            id="map-search-signalbox-line"
            onChange={(e) => {
              setSearchLine(e.target.value);
              setDontSearch(false);
            }}
            onClear={() => {
              setSearchLine('');
            }}
            value={searchLineState}
            clearButton
            noMargin
            sm
          />
        </span>
      </div>
      <div>
        {searchResults !== undefined && searchResults.results !== undefined ? (
          <div className="search-results">{formatSearchResults()}</div>
        ) : (
          <h2 className="text-center mt-3">{t('map-search:noresult')}</h2>
        )}
      </div>
    </>
  );
};

export default MapSearchSignalBox;
