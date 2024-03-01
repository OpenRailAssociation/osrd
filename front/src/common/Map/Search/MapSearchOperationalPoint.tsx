import React, { useState, useEffect, useMemo } from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { onResultSearchClick } from 'common/Map/utils';
import { useInfraID } from 'common/osrdContext';
import type { Viewport } from 'reducers/map';
import { getMap } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';
import { useDebounce } from 'utils/helpers';

const mainOperationalPointsCHCodes = ['', '00', 'BV'];

type MapSearchOperationalPointProps = {
  updateExtViewport: (viewport: Partial<Viewport>) => void;
  closeMapSearchPopUp: () => void;
};

const MapSearchOperationalPoint = ({
  updateExtViewport,
  closeMapSearchPopUp,
}: MapSearchOperationalPointProps) => {
  const map = useSelector(getMap);
  const [searchResults, setSearchResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const [chCodeFilter, setChCodeFilter] = useState('');
  const [mainOperationalPointsOnly, setMainOperationalPointsOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const infraID = useInfraID();

  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const dispatch = useAppDispatch();

  const { t } = useTranslation(['map-search']);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const sortedResults = useMemo(
    () =>
      [...searchResults]
        .map((result) => ({
          ...result,
          // remove CH Code information when it's a main operational point (=== "BV" or "00") to ensure it'll be on top of search results
          ch: mainOperationalPointsCHCodes.includes(result.ch) ? '' : result.ch,
        }))
        // Begin to filter with main operational points (CH code = ''), if not checked, filter on chCode input field
        .filter((result) => {
          if (mainOperationalPointsOnly) return result.ch === '';
          return chCodeFilter !== ''
            ? result.ch.toLocaleLowerCase().includes(chCodeFilter.trim().toLowerCase())
            : true;
        })
        .sort((a, b) => a.name.localeCompare(b.name) || a.ch.localeCompare(b.ch)),
    [searchResults, chCodeFilter, mainOperationalPointsOnly]
  );

  const searchOperationalPoints = async () => {
    const isSearchingByTrigram = !Number.isInteger(+debouncedSearchTerm) && searchTerm.length < 4;
    const searchQuery = isSearchingByTrigram
      ? // We have to test for op names that goes under 4 letters too
        ['or', ['=i', ['trigram'], debouncedSearchTerm], ['=i', ['name'], debouncedSearchTerm]]
      : [
          'or',
          ['search', ['name'], debouncedSearchTerm],
          ['like', ['to_string', ['ci']], `%${debouncedSearchTerm}%`],
        ];
    const payload = {
      object: 'operationalpoint',
      query: ['and', searchQuery, infraID !== undefined ? ['=', ['infra_id'], infraID] : true],
    };

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

  const onResultClick = (result: SearchResultItemOperationalPoint) => {
    onResultSearchClick({
      result,
      map,
      updateExtViewport,
      dispatch,
      title: result.name,
    });
    closeMapSearchPopUp();
  };

  useEffect(() => {
    if (debouncedSearchTerm) {
      searchOperationalPoints();
    } else if (searchResults.length !== 0) {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm]);

  return (
    <div className="mt-2">
      <div className="d-flex mb-2 flex-column flex-md-row">
        <span className="flex-fill col-md-6 col-xl-7 pl-0 mb-2">
          <InputSNCF
            id="map-search-operational-points"
            name="map-search-operational-points"
            placeholder={t('placeholdername')}
            title={t('placeholdername')}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            onClear={() => {
              setSearchTerm('');
              setSearchResults([]);
            }}
            clearButton
            noMargin
            sm
            focus
          />
        </span>
        <span className="col-md-3 pl-0 mb-2">
          <InputSNCF
            id="map-search-operational-points-ch-code"
            type="text"
            placeholder={t('placeholderchcode')}
            onChange={(e) => {
              setChCodeFilter(e.target.value);
            }}
            onClear={() => setChCodeFilter('')}
            value={chCodeFilter}
            disabled={mainOperationalPointsOnly}
            clearButton
            noMargin
            sm
          />
        </span>
        <span className="col-md-3 col-xl-2 pr-2 pl-0 mt-md-1">
          <CheckboxRadioSNCF
            id="map-search-operational-points-main-only"
            type="checkbox"
            label={t('mainOperationalPointsOnly')}
            checked={mainOperationalPointsOnly}
            onChange={() => setMainOperationalPointsOnly(!mainOperationalPointsOnly)}
          />
        </span>
      </div>
      <h2 className="text-center mt-3">
        {searchResults.length > 100
          ? t('resultsCountTooMuch')
          : t('resultsCount', {
              count: sortedResults.length,
            })}
      </h2>
      <div className="search-results">
        {searchResults.length > 0 &&
          searchResults.length <= 100 &&
          sortedResults.map((searchResult) => (
            <button
              type="button"
              className={cx('search-result-item', { main: searchResult.ch === '' })}
              key={`mapSearchOperationalPoint-${searchResult.obj_id}`}
              onClick={() => onResultClick(searchResult)}
            >
              <span className="trigram">{searchResult.trigram}</span>
              <span className="name">
                {searchResult.name}
                <span className="ch">{searchResult.ch}</span>
              </span>
              <span className="uic">{searchResult.uic}</span>
            </button>
          ))}
      </div>
    </div>
  );
};

export default MapSearchOperationalPoint;
