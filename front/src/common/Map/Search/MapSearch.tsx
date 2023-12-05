import React, { useCallback } from 'react';
import { getMap } from 'reducers/map/selectors';
import { useDispatch, useSelector } from 'react-redux';
import { updateViewport, updateLineSearchCode, updateMapSearchMarker } from 'reducers/map';
import { useTranslation } from 'react-i18next';
import MapSearchStation from 'common/Map/Search/MapSearchStation';
import Tabs from 'common/Tabs';
import HearderPopUp from 'common/Map/HeaderPopUp';
import MapSearchLine from 'common/Map/Search/MapSearchLine';
import MapSearchSignal from 'common/Map/Search/MapSearchSignal';

import type { MapRef } from 'react-map-gl/maplibre';
import type { Viewport } from 'reducers/map';

type MapSearchProps = {
  map?: MapRef;
  closeMapSearchPopUp: () => void;
};

const MapSearch = ({ map, closeMapSearchPopUp }: MapSearchProps) => {
  const dispatch = useDispatch();
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
            label: t('map-search:station'),
            content: (
              <MapSearchStation
                updateExtViewport={updateViewportChange}
                closeMapSearchPopUp={closeMapSearchPopUp}
              />
            ),
          },
          {
            label: t('map-search:line'),
            content: (
              <MapSearchLine
                updateExtViewport={updateViewportChange}
                closeMapSearchPopUp={closeMapSearchPopUp}
              />
            ),
          },
          {
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
