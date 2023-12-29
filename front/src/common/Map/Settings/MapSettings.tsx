import cx from 'classnames';
import React, { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';

import MapSettingsLayers from 'common/Map/Settings/MapSettingsLayers';
import MapSettingsMapStyle from 'common/Map/Settings/MapSettingsMapStyle';
import MapSettingsBackgroundSwitches from 'common/Map/Settings/MapSettingsBackgroundSwitches';
import MapSettingsSpeedLimits from 'common/Map/Settings/MapSettingsSpeedLimits';
import HearderPopUp from '../HeaderPopUp';

interface MapSettingsProps {
  closeMapSettingsPopUp: () => void;
}
const MapSettings: FC<MapSettingsProps> = ({ closeMapSettingsPopUp }) => {
  const { t } = useTranslation(['translation', 'map-settings']);
  const [showSettingsLayers, setShowSettingsLayers] = useState(false);
  const [showSettingsSpeedLimits, setShowSettingsSpeedLimits] = useState(false);

  return (
    <div className="map-modal">
      <HearderPopUp onClick={closeMapSettingsPopUp} title={t('map-settings:mapSettings')} />
      <div className="my-1" />
      <MapSettingsMapStyle />
      <div className="my-1" />
      <MapSettingsBackgroundSwitches />
      <div
        className="mb-1 mt-3 border-bottom d-flex align-items-center sub-section-title"
        onClick={() => setShowSettingsLayers((v) => !v)}
        role="button"
        tabIndex={0}
      >
        {t('map-settings:layers')}
        <i
          className={cx({ open: showSettingsLayers }, 'icons-arrow-down icons-size-20px')}
          aria-hidden="true"
        />
      </div>
      {showSettingsLayers && <MapSettingsLayers />}
      <div
        className="mb-1 mt-3 border-bottom d-flex align-items-center sub-section-title"
        onClick={() => setShowSettingsSpeedLimits((v) => !v)}
        role="button"
        tabIndex={0}
      >
        {t('map-settings:speedlimits')}
        <i
          className={cx({ open: showSettingsSpeedLimits }, 'icons-arrow-down icons-size-20px')}
          aria-hidden="true"
        />
      </div>
      {showSettingsSpeedLimits && <MapSettingsSpeedLimits />}
    </div>
  );
};

export default MapSettings;
