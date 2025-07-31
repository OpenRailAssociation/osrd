import { useEffect, useState } from 'react';

import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import MapModalHeader from 'common/Map/MapModalHeader';
import MapSettingsLayers from 'common/Map/Settings/MapSettingsLayers';
import MapSettingsSpeedLimits from 'common/Map/Settings/MapSettingsSpeedLimits';

import MapSettingsStyle from './MapSettingsStyle';

interface MapSettingsProps {
  closeMapSettingsPopUp: () => void;
}
const MapSettings = ({ closeMapSettingsPopUp }: MapSettingsProps) => {
  const { t } = useTranslation();
  const [showSettingsLayers, setShowSettingsLayers] = useState(false);
  const [showSettingsStyle, setShowSettingsStyle] = useState(false);
  const [showSettingsSpeedLimits, setShowSettingsSpeedLimits] = useState(false);

  useEffect(() => {
    setShowSettingsLayers(true);
    setShowSettingsStyle(false);
    setShowSettingsSpeedLimits(false);
  }, []);

  return (
    <div className="map-modal">
      <MapModalHeader closeAction={closeMapSettingsPopUp} title={t('mapSettings.mapSettings')} />
      <div
        className="mb-1 border-bottom d-flex align-items-center sub-section-title"
        onClick={() => setShowSettingsLayers((v) => !v)}
        role="button"
        tabIndex={0}
      >
        {t('mapSettings.map-layers')}
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
        {t('mapSettings.layers.speed_limits')}
        <span className="ml-2">
          {showSettingsSpeedLimits ? <ChevronUp size="lg" /> : <ChevronDown size="lg" />}
        </span>
      </div>
      {showSettingsSpeedLimits && <MapSettingsSpeedLimits />}

      <div
        className="mb-1 mt-3 border-bottom d-flex align-items-center sub-section-title"
        onClick={() => setShowSettingsStyle((v) => !v)}
        role="button"
        tabIndex={0}
      >
        {t('mapSettings.map-style')}
        <span className="ml-2">
          {showSettingsStyle ? <ChevronUp size="lg" /> : <ChevronDown size="lg" />}
        </span>
      </div>
      {showSettingsStyle && <MapSettingsStyle />}
    </div>
  );
};

export default MapSettings;
