import React, { useState, useEffect } from 'react';
import { FlyToInterpolator } from 'react-map-gl';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { get } from 'common/requests';
import { useDebounce } from 'utils/helpers';

const searchURI = '/gaia/osrd/signal/'; // '/matgaia/search_station';

export default function MapSearchSignal(props) {
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
      if (searchState !== '') { params.name = searchState; }
      if (searchLineState !== '') { params.linecode = searchLineState; }
      updateSearch(params);
    }
  }, [debouncedSearchTerm, debouncedSearchLine]);

  const onResultClick = (result) => {
    setDontSearch(true);
    setSearch(result.name);
    setSearchResults(undefined);

    const latlon = map.mapTrackSources === 'schematic' ? result.coordinates.sch : result.coordinates.geo;

    if (latlon !== null) {
      const newViewport = {
        ...map.viewport,
        longitude: latlon[0],
        latitude: latlon[1],
        zoom: 16,
        transitionDuration: 1000,
        transitionInterpolator: new FlyToInterpolator(),
      };
      updateExtViewport(newViewport);
    }
  };

  const formatSearchResults = () => {
    let searchResultsContent = searchResults.results.filter((result) => result.name !== null);
    searchResultsContent = searchResultsContent.sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    return searchResultsContent.map((result) => (
      <tr
        role="button"
        className="search-result-table-item"
        key={nextId()}
        onClick={() => onResultClick(result)}
      >
        <td><img src={`/signalsSVG/${result.type.replace(/ /g, '_')}.svg`} alt={result.type} /></td>
        <td>{result.name}</td>
        <td>{result.stationname}</td>
        <td>{result.linecode}</td>
        <td>{result.trackname}</td>
        <td><small>{result.pk}</small></td>
      </tr>
    ));
  };

  return (
    <>
      <div className="row mr-2">
        <div className="col-sm-6">
          <InputSNCF
            label={t('map-search:name')}
            type="text"
            placeholder={t('map-search:placeholdername')}
            id="map-search-signal"
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
        </div>
        <div className="col-sm-6">
          <InputSNCF
            label={t('map-search:linecode')}
            type="text"
            placeholder={t('map-search:placeholderline')}
            id="map-search-signal-line"
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
        </div>
      </div>
      <div>
        {searchResults !== undefined && searchResults.results !== undefined
          ? (
            <div className="search-results">
              <table>
                <tbody>
                  {formatSearchResults()}
                </tbody>
              </table>
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

MapSearchSignal.propTypes = {
  updateExtViewport: PropTypes.func.isRequired,
};
