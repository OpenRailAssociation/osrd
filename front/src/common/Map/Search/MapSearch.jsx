import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { updateViewport } from 'reducers/map';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import MapSearchStation from 'common/Map/Search/MapSearchStation';
import Tabs from 'common/Tabs';
import MapSearchLine from './MapSearchLine';
import HearderPopUp from '../HeaderPopUp';

export default function MapSearch(props) {
  const { closeMapSearchPopUp } = props;
  const dispatch = useDispatch();
  const updateViewportChange = useCallback(
    (value) => dispatch(updateViewport(value, undefined)),
    [dispatch]
  );

  const { t } = useTranslation(['translation', 'map-search']);

  return (
    <div className="map-modal">
      <HearderPopUp onClick={closeMapSearchPopUp} title={t('translation:common.search')} />
      <Tabs
        tabs={[
          {
            label: t('map-search:station'),
            content: <MapSearchStation updateExtViewport={updateViewportChange} />,
          },
          {
            label: t('map-search:line'),
            content: <MapSearchLine updateExtViewport={updateViewportChange} />,
          },
        ]}
      />
    </div>
  );
}

MapSearch.propTypes = {
  closeMapSearchPopUp: PropTypes.func.isRequired,
};
