import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { updateMapSearchMarker } from 'reducers/map';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';
import nextId from 'react-id-generator';
import StationCard from 'common/StationCard';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { getMap } from 'reducers/map/selectors';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { onResultSearchClick } from '../utils';

export default function MapSearchStation(props) {
  const { updateExtViewport } = props;
  const map = useSelector(getMap);
  const [searchState, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(undefined);
  const [trigramResults, setTrigramResults] = useState([]);
  const [nameResults, setNameResults] = useState([]);
  const infraID = useSelector(getInfraID);

  const [postSearch] = osrdEditoastApi.usePostSearchMutation();
  const dispatch = useDispatch();

  const { t } = useTranslation(['map-search']);

  const debouncedSearchTerm = useDebounce(searchState, 300);

  const resetSearchResult = () => {
    setNameResults([]);
    setTrigramResults([]);
  };

  // Create playload based on the type of search "name" or "trigram"

  const createPayload = (searchQuery) => ({
    object: 'operationalpoint',
    query: ['and', searchQuery, ['=', ['infra_id'], infraID]],
  });

  // Sort on name, and on yardname
  const orderResults = (results) =>
    results.sort((a, b) => a.name.localeCompare(b.name) || a.ch.localeCompare(b.ch));

  const searchByTrigrams = useCallback(async () => {
    const searchQuery = ['=i', ['trigram'], searchState];
    const payload = createPayload(searchQuery);
    const { data, error } = await postSearch({
      body: payload,
    });
    if (error) {
      resetSearchResult();
    } else {
      setTrigramResults(data);
    }
  }, [searchState]);

  const searchByNames = useCallback(async () => {
    const searchQuery = ['search', ['name'], searchState];
    const payload = createPayload(searchQuery);
    const { data, error } = await postSearch({
      body: payload,
    });
    if (error) {
      resetSearchResult();
    } else {
      setNameResults(orderResults([...data]));
    }
  }, [searchState]);

  const getResult = async () => {
    if (searchState.length < 3) {
      setNameResults([]);
      searchByTrigrams();
    } else if (searchState.length === 3) {
      // The trigram search should always appear first, we need two api calls here.
      searchByTrigrams();
      searchByNames();
    } else if (searchState.length > 3) {
      setTrigramResults([]);
      searchByNames();
    }
  };

  useEffect(() => {
    if (searchState) {
      getResult();
    } else {
      resetSearchResult();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  useEffect(() => {
    setSearchResults([...trigramResults, ...nameResults]);
  }, [trigramResults, nameResults]);

  const onResultClick = (result) =>
    onResultSearchClick({
      result,
      map,
      updateExtViewport,
      dispatch,
      title: result.name,
      setSearch,
    });

  const clearSearchResult = () => {
    setSearch('');
    resetSearchResult();
    setSearchResults(undefined);
    dispatch(updateMapSearchMarker(undefined));
  };

  return (
    <>
      <div className="d-flex mb-2">
        <span className="flex-grow-1">
          <InputSNCF
            type="text"
            placeholder={t('map-search:placeholdername')}
            id="map-search-station"
            onChange={(e) => {
              setSearch(e.target.value);
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
      <h2 className="text-center mt-3">
        {t('map-search:resultsCount', { count: searchResults ? searchResults.length : 0 })}
      </h2>
      <div className="search-results">
        {searchResults &&
          searchResults.map((result) => (
            <div
              className="mb-1"
              key={`mapSearchStation-${nextId()}-${result.trigram}${result.yardname}${result.uic}`}
            >
              <StationCard
                station={{ ...result, yardname: result.ch }}
                onClick={() => onResultClick(result)}
              />
            </div>
          ))}
      </div>
    </>
  );
}

MapSearchStation.propTypes = {
  updateExtViewport: PropTypes.func.isRequired,
};
