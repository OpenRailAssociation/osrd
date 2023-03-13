import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { updateMapSearchMarker } from 'reducers/map';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';
import nextId from 'react-id-generator';
import turfCenter from '@turf/center';
import StationCard from 'common/StationCard';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { getMap } from 'reducers/map/selectors';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

export default function MapSearchStation(props) {
  const { updateExtViewport } = props;
  const map = useSelector(getMap);
  const [searchState, setSearch] = useState('');
  const [dontSearch, setDontSearch] = useState(false);
  const [searchResults, setSearchResults] = useState(undefined);
  const [trigramResults, setTrigramResults] = useState([]);
  const [nameResults, setNameResults] = useState([]);
  const infraID = useSelector(getInfraID);

  const [postSearch] = osrdEditoastApi.usePostSearchMutation();
  const dispatch = useDispatch();

  const { t } = useTranslation(['map-search']);

  const updateSearch = async (params, setResults) => {
    const { data, error } = await postSearch({
      body: { object: params.object, query: params.query },
    });
    if (error) console.error(error);
    setResults(data);
  };

  const debouncedSearchTerm = useDebounce(searchState, 300);

  // Create playload based on the type of search "name" or "trigram"

  const createPlayload = (queryType) => {
    const searchQuery =
      queryType === 'name' ? ['search', ['name'], searchState] : ['=i', ['trigram'], searchState];
    const payload = {
      object: 'operationalpoint',
      query: ['and', searchQuery, ['=', ['infra_id'], infraID]],
    };
    return payload;
  };

  // Sort on name, and on yardname
  const orderResults = (results) =>
    [...results].sort((a, b) => a.name.localeCompare(b.name) || a.ch.localeCompare(b.ch));
  const getResult = async () => {
    if (!dontSearch && debouncedSearchTerm) {
      if (searchState.length < 3) {
        const searchTrigramQuery = createPlayload('trigram');
        updateSearch(searchTrigramQuery, setTrigramResults);
      } else if (searchState.length === 3) {
        const searchTrigramQuery = createPlayload('trigram');
        updateSearch(searchTrigramQuery, setTrigramResults);
        const searchNameQuery = createPlayload('name');
        updateSearch(searchNameQuery, setNameResults);
      } else if (searchState.length > 3) {
        const searchNameQuery = createPlayload('name');
        updateSearch(searchNameQuery, setNameResults);
      }
    }
  };

  useEffect(() => {
    getResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  useEffect(() => {
    setSearchResults([...trigramResults, ...orderResults(nameResults)]);
  }, [trigramResults, nameResults]);

  const onResultClick = (result) => {
    setSearch(result.name);

    const coordinates = map.mapTrackSources === 'schematic' ? result.schematic : result.geographic;

    const center = turfCenter(coordinates);

    if (result.lon !== null && result.lat !== null) {
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
    }
  };

  const clearSearchResult = () => {
    setSearch('');
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
