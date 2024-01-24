import React, { useState, useEffect } from 'react';
import { getMap } from 'reducers/map/selectors';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { createMapSearchQuery, onResultSearchClick } from 'common/Map/utils';
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

  // Sort on name, and on yardname
  const orderResults = (results: SearchResultItemOperationalPoint[]) =>
    results.slice().sort((a, b) => a.name.localeCompare(b.name) || a.ch.localeCompare(b.ch));

  const searchOperationalPoints = async () => {
    if (!isSearchingByName && searchState.length !== 6) return;
    const isSearchingByTrigram = isSearchingByName && searchState.length < 3;
    const searchQuery = isSearchingByTrigram
      ? ['=i', ['trigram'], searchState]
      : createMapSearchQuery(searchState, {
          codeColumn: 'ci',
          nameColumn: 'name',
        });
    const payload = createPayload(searchQuery);

    await postSearch({
      searchPayload: payload,
    })
      .unwrap()
      .then((results) => {
        if (isSearchingByTrigram) {
          setNameResults([]);
          setTrigramResults(results as SearchResultItemOperationalPoint[]);
        }
        if (isSearchingByName) {
          setTrigramResults([]);
          setNameResults(orderResults(results as SearchResultItemOperationalPoint[]));
        }
      })
      .catch(() => {
        resetSearchResult();
      });

    // We need to make a second api call for this case in order to obtain the results of the search by trigram and by name.
    if (isSearchingByName && searchState.length === 3) {
      await postSearch({
        searchPayload: createPayload(['=i', ['trigram'], searchState]),
      })
        .unwrap()
        .then((results) => {
          setTrigramResults(results as SearchResultItemOperationalPoint[]);
        })
        .catch(() => {
          resetSearchResult();
        });
    }
  };

  useEffect(() => {
    if (searchState) {
      searchOperationalPoints();
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
      <div className="d-flex mb-2 flex-column flex-md-row">
        <span className="flex-fill col-md-6 col-xl-7 pl-0 mb-2">
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
        <span className="col-md-3 pl-0 mb-2">
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
        <span className="col-md-3 col-xl-2 pr-2 pl-0 mt-md-1">
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
      {searchResults.length > 0 && (
        <StationCardsList
          operationalPoints={searchResults}
          stationCHcodes={stationCHcodes}
          onStationClick={onResultClick}
        />
      )}
    </>
  );
};

export default MapSearchStation;
