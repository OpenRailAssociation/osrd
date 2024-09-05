import { useState } from 'react';

import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import MapModalHeader from 'common/Map/MapModalHeader';
import MapSettingsBackgroundSwitches from 'common/Map/Settings/MapSettingsBackgroundSwitches';
import MapSettingsLayers from 'common/Map/Settings/MapSettingsLayers';
import MapSettingsMapStyle from 'common/Map/Settings/MapSettingsMapStyle';
import MapSettingsSpeedLimits from 'common/Map/Settings/MapSettingsSpeedLimits';

interface MapSettingsProps {
  closeMapSettingsPopUp: () => void;
}
const MapSettings = ({ closeMapSettingsPopUp }: MapSettingsProps) => {
  const { t } = useTranslation(['translation', 'map-settings']);
  const [showSettingsLayers, setShowSettingsLayers] = useState(false);
  const [showSettingsSpeedLimits, setShowSettingsSpeedLimits] = useState(false);

  return (
    <div className="map-modal">
      <MapModalHeader closeAction={closeMapSettingsPopUp} title={t('map-settings:mapSettings')} />
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
        <span className="ml-2">
          {showSettingsLayers ? <ChevronUp size="lg" /> : <ChevronDown size="lg" />}
        </span>
      </div>
      {showSettingsLayers && <MapSettingsLayers />}
      <div
        className="mb-1 mt-3 border-bottom d-flex align-items-center sub-section-title"
        onClick={() => setShowSettingsSpeedLimits((v) => !v)}
        role="button"
        tabIndex={0}
      >
        {t('map-settings:speedlimits')}
        <span className="ml-2">
          {showSettingsSpeedLimits ? <ChevronUp size="lg" /> : <ChevronDown size="lg" />}
        </span>
      </div>
      {showSettingsSpeedLimits && <MapSettingsSpeedLimits />}
    </div>
  );
};

export default MapSettings;
