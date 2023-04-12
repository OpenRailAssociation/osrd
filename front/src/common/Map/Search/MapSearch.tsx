import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  updateViewport,
  updateLineSearchCode,
  updateMapSearchMarker,
  Viewport,
} from 'reducers/map';
import { useTranslation } from 'react-i18next';
import MapSearchStation from 'common/Map/Search/MapSearchStation';
import Tabs from 'common/Tabs';
import { getMap } from 'reducers/map/selectors';
import MapSearchLine from './MapSearchLine';
import HearderPopUp from '../HeaderPopUp';
import MapSearchSignal from './MapSearchSignal';

type MapSearchProps = {
  closeMapSearchPopUp: () => void;
};

const MapSearch = ({ closeMapSearchPopUp }: MapSearchProps) => {
  const dispatch = useDispatch();
  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => dispatch(updateViewport(value, undefined)),
    [dispatch]
  );
  const { lineSearchCode, mapSearchMarker } = useSelector(getMap);

  const { t } = useTranslation(['translation', 'map-search']);

  const resetSearch = () => {
    dispatch(updateMapSearchMarker(undefined));
    dispatch(updateLineSearchCode(undefined));
  };

  const resetButton = () => (
    <button
      className="btn btn-secondary btn-sm"
      onClick={resetSearch}
      type="button"
      disabled={!lineSearchCode && !mapSearchMarker}
    >
      {t('map-search:reset')}
    </button>
  );

  return (
    <div className="map-modal">
      <HearderPopUp
        onClick={closeMapSearchPopUp}
        title={t('translation:common.search')}
        action={resetButton()}
      />
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
          {
            label: t('map-search:signal'),
            content: <MapSearchSignal updateExtViewport={updateViewportChange} />,
          },
          /* For future implementation
          {
            label: t('map-search:signalbox'),
            content: <MapSearchSignalBox updateExtViewport={updateViewportChange} />,
          },
          */
        ]}
      />
    </div>
  );
};

export default MapSearch;
