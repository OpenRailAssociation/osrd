import React, { useState, useEffect } from 'react';
import { getMap } from 'reducers/map/selectors';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { onResultSearchClick } from 'common/Map/utils';
import { useDebounce } from 'utils/helpers';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

import type { SearchQuery, SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import { useAppDispatch } from 'store';
import type { Viewport } from 'reducers/map';
import { useInfraID } from 'common/osrdContext';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import StationCard from 'common/StationCard';

const mainStationYardNames = ['', '00', 'BV'];

type MapSearchStationProps = {
  updateExtViewport: (viewport: Partial<Viewport>) => void;
  closeMapSearchPopUp: () => void;
};

const MapSearchStation = ({ updateExtViewport, closeMapSearchPopUp }: MapSearchStationProps) => {
  const map = useSelector(getMap);
  const [searchResults, setSearchResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const [orderedResults, setOrderedResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const [chCodeFilter, setChCodeFilter] = useState('');
  const [mainStationsOnly, setMainStationsOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const infraID = useInfraID();

  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const dispatch = useAppDispatch();

  const { t } = useTranslation(['map-search']);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Create playload based on the type of search "name" or "trigram"
  const createPayload = (searchQuery: SearchQuery) => ({
    object: 'operationalpoint',
    query: ['and', searchQuery, infraID !== undefined ? ['=', ['infra_id'], infraID] : true],
  });

  // Sort on name, and on yardname
  const orderAndFilterResults = () =>
    [...searchResults]
      .map((result) => ({
        ...result,
        // remove yard name information when it's a main station (aka "BV") to ensure it'll be on top of search results
        ch: mainStationYardNames.includes(result.ch) ? '' : result.ch,
      }))
      // Begin to filter with main stations (CH = ''), if not checked, filter on chCode input field
      .filter((result) => {
        if (mainStationsOnly) return result.ch === '';
        return chCodeFilter !== ''
          ? chCodeFilter.trim().toLowerCase() === result.ch.toLocaleLowerCase()
          : true;
      })
      .sort((a, b) => a.name.localeCompare(b.name) || a.ch.localeCompare(b.ch));

  const searchOperationalPoints = async () => {
    const isSearchingByTrigram = !Number.isInteger(+debouncedSearchTerm) && searchTerm.length < 4;
    const searchQuery = isSearchingByTrigram
      ? ['=i', ['trigram'], debouncedSearchTerm]
      : [
          'or',
          ['search', ['name'], debouncedSearchTerm],
          ['like', ['to_string', ['ci']], `%${debouncedSearchTerm}%`],
        ];
    const payload = createPayload(searchQuery);

    await postSearch({
      searchPayload: payload,
      pageSize: 101,
    })
      .unwrap()
      .then((results) => {
        setSearchResults(results as SearchResultItemOperationalPoint[]);
      })
      .catch(() => {
        setSearchResults([]);
      });
  };

  useEffect(() => {
    if (debouncedSearchTerm) {
      searchOperationalPoints();
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    setOrderedResults(orderAndFilterResults());
  }, [searchResults, chCodeFilter, mainStationsOnly]);

  const onResultClick = (result: SearchResultItemOperationalPoint) => {
    onResultSearchClick({
      result,
      map,
      updateExtViewport,
      dispatch,
      title: result.name,
      setSearchTerm,
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
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            onClear={() => setSearchTerm('')}
            clearButton
            noMargin
            sm
            focus
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
            disabled={mainStationsOnly}
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
            checked={mainStationsOnly}
            onChange={() => setMainStationsOnly(!mainStationsOnly)}
          />
        </span>
      </div>
      <h2 className="text-center mt-3">
        {searchResults.length > 100
          ? t('map-search:resultsCountTooMuch')
          : t('map-search:resultsCount', {
              count: orderedResults.length,
            })}
      </h2>
      {searchResults.length > 0 && searchResults.length <= 100 && (
        <div className="search-results">
          {orderedResults.map((searchResult) => (
            <div className="mb-1" key={`mapSearchStation-${searchResult.obj_id}`}>
              <StationCard
                station={{ ...searchResult, yardname: searchResult.ch }}
                onClick={() => onResultClick(searchResult)}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default MapSearchStation;
