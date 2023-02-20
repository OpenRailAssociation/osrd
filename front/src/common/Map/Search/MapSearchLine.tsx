import React, { useEffect, useState } from 'react';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useDebounce } from 'utils/helpers';
import { post } from 'common/requests';
import { useSelector } from 'react-redux';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { SEARCH_URL, searchPayloadType } from '../const';

const MapSearchLine: React.FC = () => {
  const { t } = useTranslation(['map-search']);

  const infraID = useSelector(getInfraID);

  const [searchState, setSearchState] = useState<string>('');
  const [searchResults, setSearchResults] = useState<string[] | undefined>(undefined);

  const debouncedSearchTerm = useDebounce(searchState, 300);

  const updateSearch = async (params: searchPayloadType) => {
    try {
      const data = await post(SEARCH_URL, params);
      setSearchResults(data);
    } catch (e) {
      console.log(e);
    }
  };

  const getPayload = () => {
    let lineName = null;
    let lineNumber = null;

    if (debouncedSearchTerm) {
      if (!Number.isNaN(Number(searchState))) {
        lineName = null;
        lineNumber = searchState;
      } else {
        lineName = searchState;
        lineNumber = null;
      }
    }

    const payload = {
      object: 'line',
      query: [
        'and',
        ['or', ['search', ['name'], lineName], ['search', ['number'], lineNumber]],
        ['=', ['infra_id'], infraID],
      ],
    };
    return payload;
  };

  const onResultClick = (result: string) => {
    console.log('result:', result);
  };

  useEffect(() => {
    // updateSearch(getPayload());
    getPayload();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  const formatSearchResults = () => {
    const searchResultsContent = searchResults;

    return searchResultsContent?.map((result) => (
      <button
        className="search-result-item d-flex justify-content-between mb-1 align-items-center"
        key={nextId()}
        onClick={() => onResultClick(result)}
        type="button"
      >
        <div>{result}</div>
      </button>
    ));
  };

  const clearSearchResult = () => {
    setSearchState('');
    setSearchResults(undefined);
    // dispatch(updateMapSearchMarker(undefined));
  };

  return (
    <>
      <div className="d-flex mb-2">
        <span className="flex-grow-1">
          <InputSNCF
            type="text"
            placeholder={t('map-search:placeholderline')}
            id="map-search-line"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSearchState(e.target.value);
              // setDontSearch(false);
            }}
            onClear={clearSearchResult}
            value={searchState}
            clearButton
            noMargin
            sm
            // focus
          />
        </span>
      </div>
      <div style={{ maxHeight: '200px', overflow: 'auto' }}>
        {searchResults !== undefined && searchResults.length > 0 ? (
          <div className="search-results pt-1 pl-1 pr-2">{formatSearchResults()}</div>
        ) : (
          <h2 className="text-center mt-3">{t('map-search:noresult')}</h2>
        )}
      </div>
    </>
  );
};

export default MapSearchLine;
