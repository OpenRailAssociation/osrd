import { useCallback, useState } from 'react';

import Slider from 'rc-slider';
import { useTranslation } from 'react-i18next';

import icon3dBuildings from 'assets/pictures/mapbuttons/mapstyle-3d-buildings.jpg';
import iconIGNCadastre from 'assets/pictures/mapbuttons/mapstyle-cadastre.jpg';
import iconOSM from 'assets/pictures/mapbuttons/mapstyle-normal.jpg';
import iconIGNBDORTHO from 'assets/pictures/mapbuttons/mapstyle-ortho.jpg';
import iconOSMTracks from 'assets/pictures/mapbuttons/mapstyle-osm-tracks.jpg';
import iconIGNSCAN25 from 'assets/pictures/mapbuttons/mapstyle-scan25.jpg';
import SwitchSNCF, { SWITCH_TYPES, type SwitchSNCFProps } from 'common/BootstrapSNCF/SwitchSNCF';

import { useMapContext } from '../useMapContext';

type MapBackgroundSettings = {
  showIGNBDORTHO: boolean;
  showIGNSCAN25: boolean;
  showIGNCadastre: boolean;
  showOSM: boolean;
  showOSM3dBuildings: boolean;
  showOSMtracksections: boolean;
};

type FormatSwitchProps = {
  name: string;
  onChange: SwitchSNCFProps['onChange'];
  state: boolean;
  icon: string;
  label: string;
};

const FormatSwitch = ({ name, onChange, state, icon, label }: FormatSwitchProps) => (
  <div className="d-flex align-items-center">
    <SwitchSNCF
      id={name}
      type={SWITCH_TYPES.switch}
      name={name}
      onChange={onChange}
      checked={state}
    />
    <img className="map-format-switch-img ml-2 rounded" src={icon} alt="" />
    <span className="ml-2">{label}</span>
  </div>
);

const MapSettingsBackgroundSwitches = () => {
  const { t } = useTranslation();
  const {
    updateMapSettings,
    terrain3DExaggeration: initialTerrain3DExaggeration,
    ...initialSettings
  } = useMapContext();

  const [terrain3DExaggeration, setTerrain3DExaggeration] = useState(initialTerrain3DExaggeration);
  const [backgroundSettings, setBackgroundSettings] =
    useState<MapBackgroundSettings>(initialSettings);

  const toggleLayer = useCallback(
    (layer: keyof MapBackgroundSettings) => {
      let updatedLayers: Partial<MapBackgroundSettings> = { [layer]: !backgroundSettings[layer] };
      if (layer === 'showOSM' && backgroundSettings.showOSM) {
        updatedLayers = { ...updatedLayers, showOSM3dBuildings: false };
      } else if (layer === 'showOSM3dBuildings' && !backgroundSettings.showOSM3dBuildings) {
        updatedLayers = { ...updatedLayers, showOSM: true };
      }

      setBackgroundSettings({ ...backgroundSettings, ...updatedLayers });
      updateMapSettings(updatedLayers);
    },
    [backgroundSettings, updateMapSettings]
  );

  const {
    showIGNBDORTHO,
    showIGNSCAN25,
    showIGNCadastre,
    showOSM,
    showOSM3dBuildings,
    showOSMtracksections,
  } = backgroundSettings;

  return (
    <>
      <FormatSwitch
        name="show-osm-switch"
        onChange={() => toggleLayer('showOSM')}
        state={showOSM}
        icon={iconOSM}
        label={t('mapSettings.layers.showOSM')}
      />
      <div className="my-2" />
      <FormatSwitch
        name="show3dBuildings"
        onChange={() => toggleLayer('showOSM3dBuildings')}
        state={showOSM3dBuildings}
        icon={icon3dBuildings}
        label={t('mapSettings.layers.showOSM3dBuildings')}
      />
      <div className="my-2" />
      <FormatSwitch
        name="show-osm-track-section-switch"
        onChange={() => toggleLayer('showOSMtracksections')}
        state={showOSMtracksections}
        icon={iconOSMTracks}
        label={t('mapSettings.layers.showOSMtracksections')}
      />
      <div className="my-2" />
      <FormatSwitch
        name="show-ign-bdortho-switch"
        onChange={() => toggleLayer('showIGNBDORTHO')}
        state={showIGNBDORTHO}
        icon={iconIGNBDORTHO}
        label={t('mapSettings.layers.showIGNBDORTHO')}
      />
      <div className="my-2" />
      <FormatSwitch
        name="show-ignscan25-switch"
        onChange={() => toggleLayer('showIGNSCAN25')}
        state={showIGNSCAN25}
        icon={iconIGNSCAN25}
        label={t('mapSettings.layers.showIGNSCAN25')}
      />
      <div className="my-2" />
      <FormatSwitch
        name="show-ign-cadastres-witch"
        onChange={() => toggleLayer('showIGNCadastre')}
        state={showIGNCadastre}
        icon={iconIGNCadastre}
        label={t('mapSettings.layers.showIGNCadastre')}
      />

      <div className="my-3 pb-3">
        <div className="d-flex align-item-center">
          <span className="flex-grow-1">{t('mapSettings.terrain3DExaggeration')}</span>
          <span className="font-weight-bolder">x{terrain3DExaggeration}</span>
        </div>
        <div className="slider p-1">
          <Slider
            min={0}
            defaultValue={1}
            max={5}
            step={0.1}
            marks={{ 0: 0, 0.5: '0.5', 1: 'x1', 2: 'x2', 5: 'x5' }}
            value={terrain3DExaggeration}
            onChange={(value) => {
              setTerrain3DExaggeration(value as number);
              updateMapSettings({ terrain3DExaggeration: value as number });
            }}
          />
        </div>
      </div>
    </>
  );
};

export default MapSettingsBackgroundSwitches;
