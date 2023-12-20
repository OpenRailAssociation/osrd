import React, { useState, useEffect, useCallback } from 'react';
import { getMap } from 'reducers/map/selectors';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { onResultSearchClick } from 'common/Map/utils';
import { updateMapSearchMarker } from 'reducers/map';
import { useDebounce } from 'utils/helpers';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

import type { SearchQuery, SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import type { Viewport } from 'reducers/map';
import { useInfraID } from 'common/osrdContext';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import StationCardsList from './StationCardList';

const stationCHcodes = ['', '00', 'BV'];

type MapSearchStationProps = {
  updateExtViewport: (viewport: Partial<Viewport>) => void;
  closeMapSearchPopUp: () => void;
};

const MapSearchStation = ({ updateExtViewport, closeMapSearchPopUp }: MapSearchStationProps) => {
  const map = useSelector(getMap);
  const [searchState, setSearch] = useState('');
  const [chCodeFilter, setChCodeFilter] = useState('');
  const [bvOnly, toggleBvOnly] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const [trigramResults, setTrigramResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const [nameResults, setNameResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const infraID = useInfraID();

  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const dispatch = useDispatch();

  const { t } = useTranslation(['map-search']);

  const debouncedSearchTerm = useDebounce(searchState, 300);

  const resetSearchResult = () => {
    setNameResults([]);
    setTrigramResults([]);
  };

  // Create playload based on the type of search "name" or "trigram"

  const createPayload = (searchQuery: SearchQuery) => ({
    object: 'operationalpoint',
    query: ['and', searchQuery, infraID !== undefined ? ['=', ['infra_id'], infraID] : true],
  });

  // Sort on name, and on yardname
  const orderResults = (results: SearchResultItemOperationalPoint[]) =>
    results.slice().sort((a, b) => a.name.localeCompare(b.name) || a.ch.localeCompare(b.ch));

  const searchByTrigrams = useCallback(async () => {
    const searchQuery = ['=i', ['trigram'], searchState];
    const payload = createPayload(searchQuery);
    await postSearch({
      searchPayload: payload,
    })
      .unwrap()
      .then((results) => {
        setTrigramResults(results as SearchResultItemOperationalPoint[]);
      })
      .catch(() => {
        resetSearchResult();
      });
  }, [searchState]);

  const searchByNames = useCallback(async () => {
    const searchQuery = ['search', ['name'], searchState];
    const payload = createPayload(searchQuery);
    await postSearch({
      searchPayload: payload,
    })
      .unwrap()
      .then((results) => {
        setNameResults(orderResults(results as SearchResultItemOperationalPoint[]));
      })
      .catch(() => {
        resetSearchResult();
      });
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
  }, [debouncedSearchTerm]);

  useEffect(() => {
    let results = [...trigramResults, ...nameResults];
    if (bvOnly) {
      results = results.filter((result) => stationCHcodes.includes(result.ch));
    } else if (chCodeFilter?.trim().length > 0) {
      results = results.filter((result) => result.ch.startsWith(chCodeFilter.toUpperCase()));
    }
    setSearchResults(results);
  }, [trigramResults, nameResults, bvOnly, chCodeFilter]);

  useEffect(() => {
    if (bvOnly) setChCodeFilter('');
  }, [bvOnly]);

  const onResultClick = (result: SearchResultItemOperationalPoint) => {
    onResultSearchClick({
      result,
      map,
      updateExtViewport,
      dispatch,
      title: result.name,
      setSearch,
    });
    closeMapSearchPopUp();
  };

  const clearSearchResult = () => {
    setSearch('');
    resetSearchResult();
    setSearchResults([]);
    dispatch(updateMapSearchMarker(undefined));
  };

  return (
    <>
      <div className="d-flex mb-2">
        <span className="flex-grow-1 pr-2">
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
          />
        </span>
        <span className="flex-grow-2 pr-2">
          <InputSNCF
            type="text"
            placeholder={t('map-search:placeholderchcode')}
            id="map-search-station-ch-code"
            onChange={(e) => {
              setChCodeFilter(e.target.value);
            }}
            onClear={() => setChCodeFilter('')}
            value={chCodeFilter}
            disabled={bvOnly}
            clearButton
            noMargin
            sm
          />
        </span>
        <span className="d-flex flex-grow-2">
          <CheckboxRadioSNCF
            type="checkbox"
            label={t('map-search:labelbvonly')}
            id="map-search-station-bv-only"
            checked={bvOnly}
            onChange={(e) => toggleBvOnly(e.target.checked)}
          />
        </span>
      </div>
      <h2 className="text-center mt-3">
        {t('map-search:resultsCount', {
          count: searchResults.length,
        })}
      </h2>
      <StationCardsList
        operationalPoints={searchResults}
        stationCHcodes={stationCHcodes}
        onStationClick={onResultClick}
      />
    </>
  );
};

export default MapSearchStation;
