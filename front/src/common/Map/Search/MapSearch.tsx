import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { MapRef } from 'react-map-gl/maplibre';

import MapSearchOperationalPoint from 'common/Map/Search/MapSearchOperationalPoint';
import Tabs from 'common/Tabs';
import HearderPopUp from 'common/Map/HeaderPopUp';
import MapSearchLine from 'common/Map/Search/MapSearchLine';
import MapSearchSignal from 'common/Map/Search/MapSearchSignal';

import { useAppDispatch } from 'store';
import type { Viewport } from 'reducers/map';
import { getMap } from 'reducers/map/selectors';
import { updateViewport, updateLineSearchCode, updateMapSearchMarker } from 'reducers/map';

type MapSearchProps = {
  map?: MapRef;
  closeMapSearchPopUp: () => void;
};

const MapSearch = ({ map, closeMapSearchPopUp }: MapSearchProps) => {
  const dispatch = useAppDispatch();
  const { smoothTravel } = useSelector(getMap);

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => {
      if (map && smoothTravel) {
        map.flyTo({
          center: {
            lng: value.longitude || map.getCenter().lng,
            lat: value.latitude || map.getCenter().lat,
          },
          zoom: value.zoom || map.getZoom(),
          essential: true,
        });
      }
      dispatch(updateViewport(value));
    },
    [dispatch, map]
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
            id: 'station',
            label: t('map-search:operationalPoint'),
            content: (
              <MapSearchOperationalPoint
                updateExtViewport={updateViewportChange}
                closeMapSearchPopUp={closeMapSearchPopUp}
              />
            ),
          },
          {
            id: 'line',
            label: t('map-search:line'),
            content: (
              <MapSearchLine
                updateExtViewport={updateViewportChange}
                closeMapSearchPopUp={closeMapSearchPopUp}
              />
            ),
          },
          {
            id: 'signal',
            label: t('map-search:signal'),
            content: (
              <MapSearchSignal
                updateExtViewport={updateViewportChange}
                closeMapSearchPopUp={closeMapSearchPopUp}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

export default MapSearch;
