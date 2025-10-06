import Slider from 'rc-slider';
import { useTranslation } from 'react-i18next';

import icon3dBuildings from 'assets/pictures/mapbuttons/mapstyle-3d-buildings.jpg';
import iconIGNCadastre from 'assets/pictures/mapbuttons/mapstyle-cadastre.jpg';
import iconOSM from 'assets/pictures/mapbuttons/mapstyle-normal.jpg';
import iconIGNBDORTHO from 'assets/pictures/mapbuttons/mapstyle-ortho.jpg';
import iconOSMTracks from 'assets/pictures/mapbuttons/mapstyle-osm-tracks.jpg';
import iconIGNSCAN25 from 'assets/pictures/mapbuttons/mapstyle-scan25.jpg';
import SwitchSNCF, { SWITCH_TYPES, type SwitchSNCFProps } from 'common/BootstrapSNCF/SwitchSNCF';
import { useMapSettingsActions } from 'reducers/commonMap';
import { type MapSettings } from 'reducers/commonMap/types';
import { useAppDispatch } from 'store';

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

const MapSettingsBackgroundSwitches = ({ mapSettings }: { mapSettings: MapSettings }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { updateMapSettings } = useMapSettingsActions();
  const {
    showIGNBDORTHO,
    showIGNSCAN25,
    showIGNCadastre,
    showOSM,
    showOSM3dBuildings,
    showOSMtracksections,
    smoothTravel,
    terrain3DExaggeration,
  } = mapSettings;

  const onShowOSMToggled = () => {
    dispatch(
      updateMapSettings({
        showOSM: !showOSM,
        ...(showOSM ? { showOSM3dBuildings: false } : undefined),
      })
    );
  };

  const onShow3dBuildingsToggled = () => {
    dispatch(
      updateMapSettings({
        showOSM3dBuildings: !showOSM3dBuildings,
        ...(!showOSM3dBuildings ? { showOSM: true } : undefined),
      })
    );
  };

  return (
    <>
      <FormatSwitch
        name="show-osm-switch"
        onChange={() => onShowOSMToggled()}
        state={showOSM}
        icon={iconOSM}
        label={t('mapSettings.layers.showOSM')}
      />
      <div className="my-2" />
      <FormatSwitch
        name="show3dBuildings"
        onChange={() => onShow3dBuildingsToggled()}
        state={showOSM3dBuildings}
        icon={icon3dBuildings}
        label={t('mapSettings.layers.showOSM3dBuildings')}
      />
      <div className="my-2" />
      <FormatSwitch
        name="show-osm-track-section-switch"
        onChange={() =>
          dispatch(updateMapSettings({ showOSMtracksections: !showOSMtracksections }))
        }
        state={showOSMtracksections}
        icon={iconOSMTracks}
        label={t('mapSettings.layers.showOSMtracksections')}
      />
      <div className="my-2" />
      <FormatSwitch
        name="show-ign-bdortho-switch"
        onChange={() => dispatch(updateMapSettings({ showIGNBDORTHO: !showIGNBDORTHO }))}
        state={showIGNBDORTHO}
        icon={iconIGNBDORTHO}
        label={t('mapSettings.layers.showIGNBDORTHO')}
      />
      <div className="my-2" />
      <FormatSwitch
        name="show-ignscan25-switch"
        onChange={() => dispatch(updateMapSettings({ showIGNSCAN25: !showIGNSCAN25 }))}
        state={showIGNSCAN25}
        icon={iconIGNSCAN25}
        label={t('mapSettings.layers.showIGNSCAN25')}
      />
      <div className="my-2" />
      <FormatSwitch
        name="show-ign-cadastres-witch"
        onChange={() => dispatch(updateMapSettings({ showIGNCadastre: !showIGNCadastre }))}
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
            onChange={(value) =>
              dispatch(updateMapSettings({ terrain3DExaggeration: value as number }))
            }
          />
        </div>
      </div>

      <FormatSwitch
        name="smoothTravel-switch"
        onChange={() => dispatch(updateMapSettings({ smoothTravel: !smoothTravel }))}
        state={smoothTravel}
        icon=""
        label={t('mapSettings.layers.smoothTravel')}
      />
    </>
  );
};

export default MapSettingsBackgroundSwitches;
