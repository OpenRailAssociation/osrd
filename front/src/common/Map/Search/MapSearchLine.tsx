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
  const [dontSearch, setDontSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<{ [key: string]: string }[] | undefined>(
    undefined
  );
  console.log('searchResults:', searchResults);

  const debouncedSearchTerm = useDebounce(searchState, 300);

  const updateSearch = async (params: searchPayloadType) => {
    try {
      const data = await post(SEARCH_URL, params);
      setSearchResults(data);
    } catch (e) {
      console.error(e);
    }
  };

  const getPayload = () => {
    let lineName = null;
    let lineCode = null;

    if (!dontSearch && debouncedSearchTerm) {
      if (!Number.isNaN(Number(searchState))) {
        lineName = null;
        lineCode = searchState;
      } else {
        lineName = searchState;
        lineCode = null;
      }
    }

    const payload = {
      object: 'tracksection',
      query: [
        'and',
        ['or', ['search', ['line_name'], lineName], ['search', ['line_code'], lineCode]],
        ['=', ['infra_id'], infraID],
      ],
    };
    return payload;
  };

  const onResultClick = (lineName: string) => {
    console.log('lineName:', lineName);
  };

  useEffect(() => {
    updateSearch(getPayload());

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  const formatSearchResults = () => {
    const searchResultsContent = searchResults;

    return searchResultsContent?.map((result) => (
      <button
        className="search-result-item d-flex justify-content-between mb-1 align-items-center"
        key={nextId()}
        onClick={() => onResultClick(result.line_name)}
        type="button"
      >
        <div className="name">{result.line_name}</div>
        <div className="text-right">
          <div className="trigram">
            {result.line_code}&nbsp;
            <span className="ch small">{}</span>
          </div>
        </div>
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
              setDontSearch(false);
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
