import { useState } from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { computeCoordinatesOnClick } from 'common/Map/utils';
import { useMapSettingsActions } from 'reducers/commonMap';
import { useAppDispatch } from 'store';

import { MAIN_OP_CH_CODES } from './consts';
import useSearchOperationalPoint from './useSearchOperationalPoint';

const MAX_DISPLAYABLE_RESULTS = 100;

type MapSearchOperationalPointProps = {
  closeMapSearchPopUp: () => void;
};

const MapSearchOperationalPoint = ({ closeMapSearchPopUp }: MapSearchOperationalPointProps) => {
  const {
    searchTerm,
    chCodeFilter,
    searchResults,
    searchResultsFilteredByCh,
    mainOperationalPointsOnly,
    setSearchTerm,
    setChCodeFilter,
    setSearchResults,
    setMainOperationalPointsOnly,
  } = useSearchOperationalPoint({ pageSize: MAX_DISPLAYABLE_RESULTS + 1 });

  const { t } = useTranslation();
  const { selectSearchResult } = useMapSettingsActions();
  const dispatch = useAppDispatch();

  const onResultClick = (result: SearchResultItemOperationalPoint) => {
    const lonlat = computeCoordinatesOnClick(result);
    dispatch(
      selectSearchResult({
        label: result.name,
        coordinates: lonlat,
      })
    );
    closeMapSearchPopUp();
  };

  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowUp':
        setSelectedResultIndex((prevIndex) => {
          const newIndex = prevIndex > 0 ? prevIndex - 1 : searchResults.length - 1;
          const element = document.getElementById(`result-${newIndex}`);
          if (element) {
            element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          }
          return newIndex;
        });
        break;
      case 'ArrowDown':
        setSelectedResultIndex((prevIndex) => {
          const newIndex = prevIndex < searchResults.length - 1 ? prevIndex + 1 : 0;
          const element = document.getElementById(`result-${newIndex}`);
          if (element) {
            element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          }
          return newIndex;
        });
        break;
      default:
        break;
    }
  };

  return (
    <div className="mt-2">
      <div className="d-flex mb-2 flex-column flex-md-row">
        <span className="flex-fill col-md-6 col-xl-7 pl-0 mb-2">
          <InputSNCF
            id="map-search-operational-points"
            name="map-search-operational-points"
            placeholder={t('mapSearch.placeholder-name')}
            title={t('mapSearch.placeholder-name')}
            inputProps={{ onKeyDown: handleKeyDown }}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSelectedResultIndex(-1);
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
            placeholder={t('mapSearch.placeholder-ch-code')}
            onChange={(e) => {
              setChCodeFilter(e.target.value || undefined);
            }}
            onClear={() => setChCodeFilter(undefined)}
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
            label={t('mapSearch.main-operational-points-only')}
            checked={mainOperationalPointsOnly}
            onChange={() => setMainOperationalPointsOnly(!mainOperationalPointsOnly)}
          />
        </span>
      </div>
      <h2 className="text-center mt-3">
        {searchResults.length > MAX_DISPLAYABLE_RESULTS
          ? t('mapSearch.too-many-results')
          : t('mapSearch.results-count', {
              count: searchResultsFilteredByCh.length,
            })}
      </h2>
      <div className="search-results">
        {searchResults.length > 0 &&
          searchResults.length <= MAX_DISPLAYABLE_RESULTS &&
          searchResultsFilteredByCh.map((searchResult, index) => (
            <button
              id={`result-${index}`}
              type="button"
              className={cx('search-result-item', {
                main: MAIN_OP_CH_CODES.includes(searchResult.ch),
                selected: index === selectedResultIndex,
              })}
              key={`mapSearchOperationalPoint-${searchResult.obj_id}`}
              onClick={() => onResultClick(searchResult)}
              tabIndex={-1}
            >
              <span className="trigram">{searchResult.trigram}</span>
              <span className="name">
                {searchResult.name}
                {!MAIN_OP_CH_CODES.includes(searchResult.ch) && (
                  <span className="ch">{searchResult.ch ?? ''}</span>
                )}
              </span>
              <span className="uic">{searchResult.ci}</span>
            </button>
          ))}
      </div>
    </div>
  );
};

export default MapSearchOperationalPoint;
