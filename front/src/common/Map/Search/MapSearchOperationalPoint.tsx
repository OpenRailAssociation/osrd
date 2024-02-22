import React, { useState, useEffect } from 'react';
import { getMap } from 'reducers/map/selectors';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { onResultSearchClick } from 'common/Map/utils';
import { useDebounce } from 'utils/helpers';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import cx from 'classnames';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import { useAppDispatch } from 'store';
import type { Viewport } from 'reducers/map';
import { useInfraID } from 'common/osrdContext';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';

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
  const [orderedResults, setOrderedResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const [chCodeFilter, setChCodeFilter] = useState('');
  const [mainOperationalPointsOnly, setMainOperationalPointsOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const infraID = useInfraID();

  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const dispatch = useAppDispatch();

  const { t } = useTranslation(['map-search']);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const sortAndFilterSearchResults = () =>
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

  useEffect(() => {
    if (debouncedSearchTerm) {
      searchOperationalPoints();
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    setOrderedResults(sortAndFilterSearchResults());
  }, [searchResults, chCodeFilter, mainOperationalPointsOnly]);

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
            id="map-search-operational-points"
            name="map-search-operational-points"
            placeholder={t('placeholdername')}
            title={t('placeholdername')}
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
              count: orderedResults.length,
            })}
      </h2>
      <div className="search-results">
        {searchResults.length > 0 &&
          searchResults.length <= 100 &&
          orderedResults.map((searchResult) => (
            <button
              type="button"
              className={cx('operational-point', { main: searchResult.ch === '' })}
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
    </>
  );
};

export default MapSearchOperationalPoint;
