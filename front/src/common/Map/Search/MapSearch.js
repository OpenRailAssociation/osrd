import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { updateViewport } from 'reducers/map';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import MapSearchStation from 'common/Map/Search/MapSearchStation';
import MapSearchSignalBox from 'common/Map/Search/MapSearchSignalBox';
import MapSearchSignal from 'common/Map/Search/MapSearchSignal';
import HearderPopUp from '../HeaderPopUp';

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
      ariaSelected: 'true',
    },
    {
      className: '',
      title: t('map-search:signalbox'),
      ariaSelected: 'false',
    },
    {
      className: '',
      title: t('map-search:signal'),
      ariaSelected: 'false',
    },
  ];

  return (
    <div className="map-modal">
      <HearderPopUp onClick={toggleMapSearch} title={t('translation:common.search')} />
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
                  aria-selected={tab.ariaSelected}
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
