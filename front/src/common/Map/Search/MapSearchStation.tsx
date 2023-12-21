import React, { useState, useEffect, useCallback } from 'react';
import { getMap } from 'reducers/map/selectors';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { onResultSearchClick } from 'common/Map/utils';
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
  const [chCodeFilter, setChCodeFilter] = useState('');
  const [bvOnly, toggleBvOnly] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const [searchState, setSearch] = useState('');
  const [trigramResults, setTrigramResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const [nameResults, setNameResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const infraID = useInfraID();

  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const dispatch = useDispatch();

  const { t } = useTranslation(['map-search']);

  const debouncedSearchTerm = useDebounce(searchState, 300);
  const isSearchingByName = (searchState.charCodeAt(0) ?? 0) > 57;

  const resetSearchResult = () => {
    setNameResults([]);
    setTrigramResults([]);
  };

  // Create playload based on the type of search "name" or "trigram"
  const createPayload = (searchQuery: SearchQuery) => ({
    object: 'operationalpoint',
    query: ['and', searchQuery, infraID !== undefined ? ['=', ['infra_id'], infraID] : true],
  });

  /** Builds the query */
  const createQuery = (isSearchByTrigram?: boolean) => {
    if (isSearchByTrigram) return ['=i', ['trigram'], searchState];
    return isSearchingByName
      ? ['search', ['name'], searchState]
      : ['=', ['ci'], Number(searchState)];
  };

  // Sort on name, and on yardname
  const orderResults = (results: SearchResultItemOperationalPoint[]) =>
    results.slice().sort((a, b) => a.name.localeCompare(b.name) || a.ch.localeCompare(b.ch));

  const searchByTrigrams = useCallback(async () => {
    const searchQuery = createQuery(true);
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

  const searchByCodesAndNames = async () => {
    const searchQuery = createQuery();
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
  };

  const getResult = async () => {
    if (!isSearchingByName && searchState.length !== 6) return;
    if (searchState.length > 3) {
      setTrigramResults([]);
      searchByCodesAndNames();
    } else if (searchState.length === 3) {
      // The trigram search should always appear first, we need two api calls here.
      searchByTrigrams();
      searchByCodesAndNames();
    } else if (searchState.length > 0) {
      setNameResults([]);
      searchByTrigrams();
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

  return (
    <>
      <div className="d-flex mb-2">
        <span className="flex-fill mr-2">
          <InputSNCF
            id="map-search-station"
            name="map-search-station"
            placeholder={t('map-search:placeholdername')}
            title={t('map-search:placeholdername')}
            type="text"
            value={searchState}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            onClear={() => setSearch('')}
            clearButton
            noMargin
            sm
          />
        </span>
        <span className="flex-fill mr-2">
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
        <span className="d-flex flex-fill">
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
