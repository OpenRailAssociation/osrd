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

const searchURI = '/gaia/osrd/signal/';

export default function MapSearchSignal(props) {
  const { updateExtViewport } = props;
  const map = useSelector((state) => state.map);

  const [searchState, setSearch] = useState('');
  const [searchLineState, setSearchLine] = useState('');
  const [dontSearch, setDontSearch] = useState(false);
  const [searchResults, setSearchResults] = useState(undefined);
  // Sort by, and order 0 = ASC, 1 = DESC
  const [sortFilter, setSortFilter] = useState({ name: 'name', order: 0 });
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
  const debouncedSearchLine = useDebounce(searchLineState, 300);

  useEffect(() => {
    if (!dontSearch && (debouncedSearchTerm || debouncedSearchLine)) {
      const params = {};
      if (searchState !== '') { params.name = searchState; }
      if (searchLineState !== '') { params.linecode = searchLineState; }
      updateSearch(params);
    }
  }, [debouncedSearchTerm, debouncedSearchLine]);

  const setSortName = (name) => {
    if (name === sortFilter.name) {
      setSortFilter({ name, order: 1 - sortFilter.order });
    } else {
      setSortFilter({ name, order: 0 });
    }
  };

  const onResultClick = (result) => {
    const lonlat = map.mapTrackSources === 'schematic' ? result.coordinates.sch : result.coordinates.geo;

    if (lonlat !== null) {
      const newViewport = {
        ...map.viewport,
        longitude: lonlat[0],
        latitude: lonlat[1],
        zoom: 16,
        transitionDuration: 1000,
        transitionInterpolator: new FlyToInterpolator(),
      };
      updateExtViewport(newViewport);
      dispatch(updateMapSearchMarker({ title: result.name, subtitle: result.stationname, lonlat }));
    }
  };

  const orderDisplay = (name) => {
    if (name === sortFilter.name) {
      return sortFilter.order === 0
        ? <i className="icons-arrow-down icons-size-x5 ml-1" />
        : <i className="icons-arrow-up icons-size-x5 ml-1" />;
    }
    return null;
  };

  const formatSearchResults = () => {
    let searchResultsContent = searchResults.results.filter((result) => result.name !== null);
    searchResultsContent = searchResultsContent.sort((a, b) => {
      if (!a.[sortFilter.name]) { return -1; } // To avoid null values
      if (!b.[sortFilter.name]) { return 1; }
      return sortFilter.order === 0
        ? a.[sortFilter.name].localeCompare(b.[sortFilter.name])
        : b.[sortFilter.name].localeCompare(a.[sortFilter.name]);
    });
    return searchResultsContent.map((result) => (
      <div
        role="button"
        tabIndex={-1}
        className="row search-result-table-item align-items-center"
        key={nextId()}
        onClick={() => onResultClick(result)}
      >
        <div className="col-1"><img src={`/signalsSVG/${result.type.replace(/ /g, '_')}.svg`} alt={result.type} /></div>
        <div className="col-1 small">{result.name}</div>
        <div className="col-3">{result.stationname}</div>
        <div className="col-2">{result.linecode}</div>
        <div className="col-3 small">{result.trackname}</div>
        <div className="col-2"><small>{result.pk}</small></div>
      </div>
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
            <>
              <div className="row mt-3 px-3 small no-gutters">
                <div className="col-1" role="button" onClick={() => setSortName('type')} tabIndex={-1}>
                  {t('map-search:type')}
                  {orderDisplay('type')}
                </div>
                <div className="col-1" role="button" onClick={() => setSortName('name')} tabIndex={-1}>
                  {t('map-search:name')}
                  {orderDisplay('name')}
                </div>
                <div className="col-3" role="button" onClick={() => setSortName('stationname')} tabIndex={-1}>
                  {t('map-search:station')}
                  {orderDisplay('stationname')}
                </div>
                <div className="col-2" role="button" onClick={() => setSortName('linecode')} tabIndex={-1}>
                  {t('map-search:linecode')}
                  {orderDisplay('linecode')}
                </div>
                <div className="col-3" role="button" onClick={() => setSortName('trackname')} tabIndex={-1}>
                  {t('map-search:trackname')}
                  {orderDisplay('trackname')}
                </div>
                <div className="col-2" role="button" onClick={() => setSortName('pk')} tabIndex={-1}>
                  {t('map-search:pk')}
                  {orderDisplay('pk')}
                </div>
              </div>
              <div className="search-results">
                {formatSearchResults()}
              </div>
            </>
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
