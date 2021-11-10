import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { updateViewport } from 'reducers/map';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import MapSearchStation from 'common/Map/Search/MapSearchStation';
import MapSearchSignalBox from 'common/Map/Search/MapSearchSignalBox';
import MapSearchSignal from 'common/Map/Search/MapSearchSignal';

export default function MapSearch(props) {
  const dispatch = useDispatch();
  const updateViewportChange = useCallback(
    (value) => dispatch(updateViewport(value, undefined)), [dispatch],
  );

  const {
    active, toggleMapSearch,
  } = props;
  const { t } = useTranslation(['translation', 'map-search']);
  return (
    <div className={`map-modal${active ? ' active' : ''}`}>
      <div className="h2">
        {t('translation:common.search')}
      </div>

      <div className="actionbar">
        <nav role="navigation" className="position-relative mt-2">
          <ul className="nav nav navtabs mb-0 dragscroll" role="tablist" id="listeTitreOnglets">
            <li className="navtabs-item pr-4">
              <a href="#tab1" className="active" id="titletab1" data-toggle="tab" role="tab" aria-controls="tab1" aria-selected="true">
                {t('map-search:station')}
              </a>
            </li>
            <li className="navtabs-item pr-4">
              <a href="#tab2" id="titletab2" data-toggle="tab" role="tab" aria-controls="tab2" aria-selected="false">
                {t('map-search:signalbox')}
              </a>
            </li>
            <li className="navtabs-item pr-4">
              <a href="#tab3" id="titletab3" data-toggle="tab" role="tab" aria-controls="tab3" aria-selected="false">
                {t('map-search:signal')}
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="tab-content" id="myTabContent">
        <div className="tab-pane fade show active" id="tab1" role="tabpanel" aria-labelledby="titletab1">
          <MapSearchStation updateExtViewport={updateViewportChange} />
        </div>
        <div className="tab-pane fade" id="tab2" role="tabpanel" aria-labelledby="titletab2">
          <MapSearchSignalBox updateExtViewport={updateViewportChange} />
        </div>
        <div className="tab-pane fade" id="tab3" role="tabpanel" aria-labelledby="titletab3">
          <MapSearchSignal updateExtViewport={updateViewportChange} />
        </div>
      </div>

      <div className="mt-2 d-flex flex-row-reverse w-100">
        <button className="btn btn-secondary btn-sm" type="button" onClick={toggleMapSearch}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}

MapSearch.propTypes = {
  active: PropTypes.bool,
  toggleMapSearch: PropTypes.func.isRequired,
};

MapSearch.defaultProps = {
  active: false,
};
