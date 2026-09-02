import { useState } from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { computeCoordinatesOnClick } from 'common/Map/utils';
import { useInfraID } from 'common/osrdContext';
import { useMapSettingsActions } from 'reducers/commonMap';
import { useAppDispatch } from 'store';

import useSearchOperationalPoint from './useSearchOperationalPoint';

const MAX_DISPLAYABLE_RESULTS = 100;

type MapSearchOperationalPointProps = {
  closeMapSearchPopUp: () => void;
};

const MapSearchOperationalPoint = ({ closeMapSearchPopUp }: MapSearchOperationalPointProps) => {
  const infraId = useInfraID();
  const {
    searchTerm,
    secondaryCodeFilter,
    searchResults,
    searchResultsFilteredBySecondaryCode,
    mainOperationalPointsOnly,
    setSearchTerm,
    setSecondaryCodeFilter,
    setMainOperationalPointsOnly,
  } = useSearchOperationalPoint({ infraId, pageSize: MAX_DISPLAYABLE_RESULTS + 1 });

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
              setSecondaryCodeFilter(e.target.value || undefined);
            }}
            onClear={() => setSecondaryCodeFilter(undefined)}
            value={secondaryCodeFilter ?? undefined}
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
              count: searchResultsFilteredBySecondaryCode.length,
            })}
      </h2>
      <div className="search-results">
        {searchResults.length > 0 &&
          searchResults.length <= MAX_DISPLAYABLE_RESULTS &&
          searchResultsFilteredBySecondaryCode.map((searchResult, index) => {
            const hasNoGeo = searchResult.geographic === null;
            return (
              <button
                id={`result-${index}`}
                type="button"
                className={cx('search-result-item', {
                  main: searchResult.is_passenger_station,
                  selected: index === selectedResultIndex,
                })}
                key={`mapSearchOperationalPoint-${searchResult.obj_id}`}
                onClick={() => onResultClick(searchResult)}
                tabIndex={-1}
                disabled={hasNoGeo}
              >
                <span className="main-code">{searchResult.main_code}</span>
                <span className="name">
                  {searchResult.name}
                  {!searchResult.is_passenger_station && (
                    <span className="secondary-code">{searchResult.secondary_code ?? ''}</span>
                  )}
                </span>
                <span className="uic">{searchResult.uic}</span>
                {hasNoGeo && (
                  <div className="error-line">
                    <i className="icons-warning" />
                    <span>Geographical position unavailable</span>
                  </div>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
};

export default MapSearchOperationalPoint;
