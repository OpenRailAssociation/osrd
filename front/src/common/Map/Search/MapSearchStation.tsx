import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Viewport, updateMapSearchMarker } from 'reducers/map';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';
import nextId from 'react-id-generator';
import turfCenter from '@turf/center';
import StationCard from 'common/StationCard';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { getMap } from 'reducers/map/selectors';
import {
  SearchQuery,
  osrdEditoastApi,
  SearchOperationalPointResult,
} from 'common/api/osrdEditoastApi';

type MapSearchStationProps = {
  updateExtViewport: (viewport: Partial<Viewport>) => void;
};

const MapSearchStation = ({ updateExtViewport }: MapSearchStationProps) => {
  const map = useSelector(getMap);
  const [searchState, setSearch] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchOperationalPointResult[] | undefined>(
    undefined
  );
  const [trigramResults, setTrigramResults] = useState<SearchOperationalPointResult[]>([]);
  const [nameResults, setNameResults] = useState<SearchOperationalPointResult[]>([]);
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

  const createPayload = (searchQuery: (string | string[])[]) => ({
    object: 'operationalpoint',
    query: ['and', searchQuery, ['=', ['infra_id'], infraID]] as SearchQuery,
  });

  // Sort on name, and on yardname
  const orderResults = (results: SearchOperationalPointResult[]) =>
    results.sort((a, b) => a.name.localeCompare(b.name) || a.ch.localeCompare(b.ch));

  const searchByTrigrams = useCallback(async () => {
    const searchQuery = ['=i', ['trigram'], searchState];
    const payload = createPayload(searchQuery);
    await postSearch({
      body: payload,
    })
      .unwrap()
      .then((results) => {
        setTrigramResults(results as SearchOperationalPointResult[]);
      })
      .catch(() => {
        resetSearchResult();
      });
  }, [searchState]);

  const searchByNames = useCallback(async () => {
    const searchQuery = ['search', ['name'], searchState];
    const payload = createPayload(searchQuery);
    await postSearch({
      body: payload,
    })
      .unwrap()
      .then((results) => {
        setNameResults(orderResults([...(results as SearchOperationalPointResult[])]));
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  useEffect(() => {
    setSearchResults([...trigramResults, ...nameResults]);
  }, [trigramResults, nameResults]);

  const onResultClick = (result: SearchOperationalPointResult) => {
    setSearch(result.name);

    const coordinates = map.mapTrackSources === 'schematic' ? result.schematic : result.geographic;

    const center = turfCenter(coordinates);

    const newViewport = {
      ...map.viewport,
      longitude: center.geometry.coordinates[0],
      latitude: center.geometry.coordinates[1],
      zoom: 12,
    };
    updateExtViewport(newViewport);
    dispatch(
      updateMapSearchMarker({
        title: result.name,
        lonlat: [center.geometry.coordinates[0], center.geometry.coordinates[1]],
      })
    );
  };

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
              key={`mapSearchStation-${nextId()}-${result.trigram}${result.uic}`}
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
};

export default MapSearchStation;
