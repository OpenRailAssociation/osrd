import { useCallback } from 'react';

import { useTranslation } from 'react-i18next';
import type { MapRef } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import MapSearchLine from 'common/Map/Search/MapSearchLine';
import MapSearchOperationalPoint from 'common/Map/Search/MapSearchOperationalPoint';
import MapSearchSignal from 'common/Map/Search/MapSearchSignal';
import Tabs from 'common/Tabs';
import type { Viewport } from 'reducers/map';
import { updateViewport } from 'reducers/map';
import { getMap } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';

import MapModalHeader from '../MapModalHeader';

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

  const { t } = useTranslation(['translation', 'map-search']);

  return (
    <div className="map-modal">
      <MapModalHeader title={t('translation:common.search')} closeAction={closeMapSearchPopUp} />
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
