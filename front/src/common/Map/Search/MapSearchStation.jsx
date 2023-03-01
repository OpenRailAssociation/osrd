import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { updateMapSearchMarker } from 'reducers/map';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { post } from 'common/requests';
import { useDebounce } from 'utils/helpers';
import turfCenter from '@turf/center';
import StationCard from 'common/StationCard';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { SEARCH_URL } from '../const';

export default function MapSearchStation(props) {
  const { updateExtViewport } = props;
  const map = useSelector((state) => state.map);

  const [searchState, setSearch] = useState('');
  const [dontSearch, setDontSearch] = useState(false);
  const [searchResults, setSearchResults] = useState(undefined);
  const infraID = useSelector(getInfraID);

  const dispatch = useDispatch();

  const { t } = useTranslation(['map-search']);

  const updateSearch = async (params) => {
    try {
      const data = await post(SEARCH_URL, params);
      setSearchResults(data);
    } catch (e) {
      /* empty */
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
        ['=', ['infra_id'], infraID],
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

  const clearSearchResult = () => {
    setSearch('');
    setSearchResults(undefined);
    dispatch(updateMapSearchMarker(undefined));
  };

  // Sort on name, and on yardname
  const orderResults = (results) =>
    results.sort((a, b) => a.name.localeCompare(b.name) || a.ch.localeCompare(b.ch));

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
          orderResults(searchResults).map((result) => (
            <div className="mb-1" key={`${result.trigram}${result.yardname}${result.uic}`}>
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
