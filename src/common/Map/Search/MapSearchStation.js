import React, { useState, useEffect } from 'react';
import { FlyToInterpolator } from 'react-map-gl';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { updateMapSearchMarker } from 'reducers/map';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { get } from 'common/requests';
import { useDebounce } from 'utils/helpers';

const searchURI = '/gaia/osrd/station/'; // '/matgaia/search_station';

export default function MapSearchStation(props) {
  const { updateExtViewport } = props;
  const map = useSelector((state) => state.map);

  const [searchState, setSearch] = useState('');
  const [dontSearch, setDontSearch] = useState(false);
  const [searchResults, setSearchResults] = useState(undefined);
  const dispatch = useDispatch();

  const { t } = useTranslation(['translation', 'map-search']);

  const updateSearch = async (params) => {
    try {
      const data = await get(searchURI, params, true);
      console.log('coucou', data);
      setSearchResults(data);
    } catch (e) {
      console.log(e);
    }
  };

  const debouncedSearchTerm = useDebounce(searchState, 300);

  useEffect(() => {
    if (!dontSearch && debouncedSearchTerm) {
      const params = { q: searchState };
      updateSearch(params);
    }
  }, [debouncedSearchTerm]);

  const onResultClick = (result) => {
    setSearch(result.name);

    const lonlat = map.mapTrackSources === 'schematic' ? result.coordinates.sch : result.coordinates.geo;

    if (lonlat !== null) {
      const newViewport = {
        ...map.viewport,
        longitude: lonlat[0],
        latitude: lonlat[1],
        zoom: 12,
        transitionDuration: 1000,
        transitionInterpolator: new FlyToInterpolator(),
      };
      updateExtViewport(newViewport);
      dispatch(updateMapSearchMarker({ title: result.name, lonlat }));
    }
  };

  const formatSearchResults = () => {
    // sort name, then by mainstation true then false
    let searchResultsContent = searchResults.results.sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    searchResultsContent = searchResultsContent.sort(
      (a, b) => Number(b.mainstation) - Number(a.mainstation),
    );
    return searchResultsContent.map((result) => (
      <button
        type="button"
        className="search-result-item"
        key={nextId()}
        onClick={() => onResultClick(result)}
      >
        {result.name}
      </button>
    ));
  };

  const clearSearchResult = () => {
    setSearch('');
    setSearchResults(undefined);
    dispatch(updateMapSearchMarker(undefined));
  };

  return (
    <>
      <div className="d-flex">
        <span className="flex-grow-1 mr-2">
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
          />
        </span>
      </div>
      <div>
        {searchResults !== undefined && searchResults.results !== undefined
          ? (
            <div className="search-results">
              {formatSearchResults()}
            </div>
          ) : (
            <h2 className="text-center mt-3">
              {t('map-search:noresult')}
            </h2>
          )}
      </div>
    </>
  );
}

MapSearchStation.propTypes = {
  updateExtViewport: PropTypes.func.isRequired,
};
