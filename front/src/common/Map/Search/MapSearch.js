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
    (value) => dispatch(updateViewport(value, undefined)),
    [dispatch]
  );

  const { toggleMapSearch } = props;

  const { t } = useTranslation(['translation', 'map-search']);

  const tabItems = [
    {
      className: 'active',
      title: t('map-search:station'),
    },
    {
      className: '',
      title: t('map-search:signalbox'),
    },
    {
      className: '',
      title: t('map-search:signal'),
    },
  ];

  return (
    <div className="map-modal">
      <div className="d-flex justify-content-between align-items-start">
        <div className="h2">{t('translation:common.search')}</div>
        <button type="button" className="close" onClick={toggleMapSearch}>
          &times;
        </button>
      </div>

      <div className="actionbar">
        <nav role="navigation" className="position-relative mt-2">
          <ul className="nav nav navtabs mb-0 dragscroll" role="tablist" id="listeTitreOnglets">
            {tabItems.map((tab, index) => (
              <li className="navtabs-item pr-4" key={`tab-${tab.title}`}>
                <a
                  href={`#tab${index + 1}`}
                  className={tab.className}
                  id={`titletab${index + 1}`}
                  data-toggle="tab"
                  role="tab"
                  aria-controls={`tab${index + 1}`}
                  aria-selected="true"
                >
                  {tab.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="tab-content" id="myTabContent">
        <div
          className="tab-pane fade show active"
          id="tab1"
          role="tabpanel"
          aria-labelledby="titletab1"
        >
          <MapSearchStation updateExtViewport={updateViewportChange} />
        </div>
        <div className="tab-pane fade" id="tab2" role="tabpanel" aria-labelledby="titletab2">
          <MapSearchSignalBox updateExtViewport={updateViewportChange} />
        </div>
        <div className="tab-pane fade" id="tab3" role="tabpanel" aria-labelledby="titletab3">
          <MapSearchSignal updateExtViewport={updateViewportChange} />
        </div>
      </div>
    </div>
  );
}

MapSearch.propTypes = {
  toggleMapSearch: PropTypes.func.isRequired,
};
