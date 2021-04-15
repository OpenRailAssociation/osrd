import React, { useState, useEffect } from 'react';
import { FlyToInterpolator } from 'react-map-gl';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { get } from 'common/requests';
import { useDebounce } from 'utils/helpers';

const searchURI = '/gaia/osrd/signalbox/'; // '/matgaia/search_station';

export default function MapSearchSignalBox(props) {
  const { updateExtViewport } = props;
  const map = useSelector((state) => state.map);

  const [searchState, setSearch] = useState('');
  const [searchLineState, setSearchLine] = useState('');
  const [dontSearch, setDontSearch] = useState(false);
  const [searchResults, setSearchResults] = useState(undefined);

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
  const debouncedSearchLine = useDebounce(searchLineState, 300);

  useEffect(() => {
    if (!dontSearch && (debouncedSearchTerm || debouncedSearchLine)) {
      const params = {};
      if (searchState !== '') { params.q = searchState; }
      if (searchLineState !== '') { params.linecode = searchLineState; }
      updateSearch(params);
    }
  }, [debouncedSearchTerm, debouncedSearchLine]);

  /*
   * Convert data from signalboxes in geojson format
  */
  const cdv2geosjon = (data) => ({
    type: 'FeatureCollection',
    features: data.map((item) => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiLineString',
        coordinates: item,
      },
    })),
  });

  const onResultClick = (result) => {
    setDontSearch(true);
    setSearch(result.name);
    setSearchResults(undefined);

    const geojson = map.mapTrackSources === 'schematic'
      ? cdv2geosjon(result.coordinates.sch) : cdv2geosjon(result.coordinates.geo);

    console.log('geojson', geojson);

    /* if (latlon !== null) {
      const newViewport = {
        ...map.viewport,
        longitude: latlon[0],
        latitude: latlon[1],
        zoom: 12,
        transitionDuration: 1000,
        transitionInterpolator: new FlyToInterpolator(),
      };
      updateExtViewport(newViewport);
    } */
  };

  const formatSearchResults = () => {
    const searchResultsContent = searchResults.results.sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    return searchResultsContent.map((result) => (
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

MapSearchSignalBox.propTypes = {
  updateExtViewport: PropTypes.func.isRequired,
};
