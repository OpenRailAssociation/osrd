import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { updateMapSearchMarker } from 'reducers/map';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { post } from 'common/requests';
import { useDebounce } from 'utils/helpers';
import turfCenter from '@turf/center';

export default function MapSearchStation(props) {
  const { updateExtViewport } = props;
  const map = useSelector((state) => state.map);

  const [searchState, setSearch] = useState('');
  const [dontSearch, setDontSearch] = useState(false);
  const [searchResults, setSearchResults] = useState(undefined);
  const osrdconf = useSelector((state) => state.osrdconf);

  const dispatch = useDispatch();
  const searchURI = `/editoast/search`;

  const { t } = useTranslation(['map-search']);

  const updateSearch = async (params) => {
    try {
      const data = await post(searchURI, params);
      setSearchResults(data);
    } catch (e) {
      console.log(e);
    }
  };

  const debouncedSearchTerm = useDebounce(searchState, 300);

  const getPayload = () => {
    let trigram = null;
    let name = null;
    if (!dontSearch && debouncedSearchTerm) {
      if (searchState.length < 3) {
        trigram = searchState;
        name = null;
      } else if (searchState.length === 3) {
        trigram = searchState;
        name = searchState;
      } else if (searchState.length > 3) {
        name = searchState;
        trigram = null;
      }
    }
    const payload = {
      object: 'operationalpoint',
      query: [
        'and',
        ['or', ['search', ['name'], name], ['search', ['trigram'], trigram]],
        ['=', ['infra_id'], osrdconf.infraID],
      ],
    };
    return payload;
  };

  useEffect(() => {
    updateSearch(getPayload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

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

  const formatSearchResults = () => {
    // sort name, then by mainstation true then false
    let searchResultsContent = searchResults.sort((a, b) => a.name.localeCompare(b.name));
    searchResultsContent = searchResultsContent.sort(
      (a, b) => Number(b.mainstation) - Number(a.mainstation)
    );
    return searchResultsContent.map((result) => (
      <button
        className="search-result-item d-flex justify-content-between mb-1 align-items-center"
        key={nextId()}
        onClick={() => onResultClick(result)}
        type="button"
      >
        <div className="name">{result.name}</div>
        <div className="text-right">
          <div className="trigram">
            {result.trigram}&nbsp;
            <span className="ch small">{result.ch}</span>
          </div>
        </div>
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
      <div style={{ maxHeight: '200px', overflow: 'auto' }}>
        {searchResults !== undefined && searchResults.length > 0 ? (
          <div className="search-results pt-1 pl-1 pr-2">{formatSearchResults()}</div>
        ) : (
          <h2 className="text-center mt-3">{t('map-search:noresult')}</h2>
        )}
      </div>
    </>
  );
}

MapSearchStation.propTypes = {
  updateExtViewport: PropTypes.func.isRequired,
};
