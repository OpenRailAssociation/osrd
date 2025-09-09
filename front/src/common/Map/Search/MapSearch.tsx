import { useCallback } from 'react';

import { useTranslation } from 'react-i18next';
import type { MapRef } from 'react-map-gl/maplibre';

import MapSearchLine from 'common/Map/Search/MapSearchLine';
import MapSearchOperationalPoint from 'common/Map/Search/MapSearchOperationalPoint';
import MapSearchSignal from 'common/Map/Search/MapSearchSignal';
import Tabs from 'common/Tabs';
import { useMapSettingsActions } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import { useAppDispatch } from 'store';

import MapModalHeader from '../MapModalHeader';

type MapSearchProps = {
  map?: MapRef;
  closeMapSearchPopUp: () => void;
  mapSettings: MapSettings;
};

const MapSearch = ({ map, closeMapSearchPopUp, mapSettings }: MapSearchProps) => {
  const { smoothTravel } = mapSettings;
  const { updateViewport } = useMapSettingsActions();
  const dispatch = useAppDispatch();

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
    [map, smoothTravel]
  );

  const { t } = useTranslation();

  return (
    <div className="map-modal">
      <MapModalHeader title={t('common.search')} closeAction={closeMapSearchPopUp} />
      <Tabs
        tabs={[
          {
            id: 'station',
            label: t('mapSearch.operational-point'),
            content: <MapSearchOperationalPoint closeMapSearchPopUp={closeMapSearchPopUp} />,
          },
          {
            id: 'line',
            label: t('mapSearch.line'),
            content: (
              <MapSearchLine
                updateExtViewport={updateViewportChange}
                closeMapSearchPopUp={closeMapSearchPopUp}
                mapSettings={mapSettings}
              />
            ),
          },
          {
            id: 'signal',
            label: t('mapSearch.signal'),
            content: <MapSearchSignal closeMapSearchPopUp={closeMapSearchPopUp} />,
          },
        ]}
      />
    </div>
  );
};

export default MapSearch;
