import { useCallback } from 'react';

import { useTranslation } from 'react-i18next';

import MapSearchLine from 'common/Map/Search/MapSearchLine';
import MapSearchOperationalPoint from 'common/Map/Search/MapSearchOperationalPoint';
import MapSearchSignal from 'common/Map/Search/MapSearchSignal';
import Tabs from 'common/Tabs';
import { useMapSettingsActions } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import { useAppDispatch } from 'store';

import MapModalHeader from '../MapModalHeader';

type MapSearchProps = {
  closeMapSearchPopUp: () => void;
  mapSettings: MapSettings;
};

const MapSearch = ({ closeMapSearchPopUp, mapSettings }: MapSearchProps) => {
  const { smoothTravel } = mapSettings;
  const { updateViewport } = useMapSettingsActions();
  const dispatch = useAppDispatch();

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => {
      dispatch(updateViewport(value));
    },
    [smoothTravel]
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
