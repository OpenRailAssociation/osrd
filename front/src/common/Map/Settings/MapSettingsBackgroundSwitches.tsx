import Slider from 'rc-slider';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import icon3dBuildings from 'assets/pictures/mapbuttons/mapstyle-3d-buildings.jpg';
import iconIGNCadastre from 'assets/pictures/mapbuttons/mapstyle-cadastre.jpg';
import iconOSM from 'assets/pictures/mapbuttons/mapstyle-normal.jpg';
import iconIGNBDORTHO from 'assets/pictures/mapbuttons/mapstyle-ortho.jpg';
import iconOSMTracks from 'assets/pictures/mapbuttons/mapstyle-osm-tracks.jpg';
import iconIGNSCAN25 from 'assets/pictures/mapbuttons/mapstyle-scan25.jpg';
import SwitchSNCF, {
  SWITCH_TYPES,
  type SwitchSNCFProps,
} from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import {
  updateShowIGNBDORTHO,
  updateShowIGNCadastre,
  updateShowIGNSCAN25,
  updateShowOSM,
  updateShowOSM3dBuildings,
  updateShowOSMtracksections,
  updateTerrain3DExaggeration,
  updateSmoothTravel,
} from 'reducers/map';
import { getMap, getTerrain3DExaggeration } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';

type FormatSwitchProps = {
  name: string;
  onChange: SwitchSNCFProps['onChange'];
  state: boolean;
  icon: string;
  label: string;
  disabled?: boolean;
};

const FormatSwitch = ({ name, onChange, state, icon, label, disabled }: FormatSwitchProps) => {
  const { t } = useTranslation(['map-settings']);
  return (
    <div className="d-flex align-items-center">
      <SwitchSNCF
        id={name}
        type={SWITCH_TYPES.switch}
        name={name}
        onChange={onChange}
        checked={state}
        disabled={disabled}
      />
      <img className="map-format-switch-img ml-2 rounded" src={icon} alt="" />
      <span className="ml-2">{t(label)}</span>
    </div>
  );
};

const MapSettingsBackgroundSwitches = () => {
  const { t } = useTranslation(['map-settings']);
  const {
    mapStyle,
    showIGNBDORTHO,
    showIGNSCAN25,
    showIGNCadastre,
    showOSM,
    showOSM3dBuildings,
    showOSMtracksections,
    smoothTravel,
  } = useSelector(getMap);
  const terrain3DExaggeration = useSelector(getTerrain3DExaggeration);
  const dispatch = useAppDispatch();

  const isBlueprint = mapStyle === 'blueprint';
  return (
    <>
      <FormatSwitch
        name="show-osm-switch"
        onChange={() => dispatch(updateShowOSM(!showOSM))}
        state={showOSM}
        icon={iconOSM}
        label="showOSM"
      />
      <div className="my-2" />
      <FormatSwitch
        name="show3dBuildings"
        onChange={() => dispatch(updateShowOSM3dBuildings(!showOSM3dBuildings))}
        state={!isBlueprint ? showOSM3dBuildings : false}
        icon={icon3dBuildings}
        disabled={isBlueprint}
        label="showOSM3dBuildings"
      />
      <div className="my-2" />
      <FormatSwitch
        name="show-osm-track-section-switch"
        onChange={() => dispatch(updateShowOSMtracksections(!showOSMtracksections))}
        state={showOSMtracksections}
        icon={iconOSMTracks}
        label="showOSMtracksections"
      />
      <div className="my-2" />
      <FormatSwitch
        name="show-ign-bdortho-switch"
        onChange={() => dispatch(updateShowIGNBDORTHO(!showIGNBDORTHO))}
        state={showIGNBDORTHO}
        icon={iconIGNBDORTHO}
        label="showIGNBDORTHO"
      />
      <div className="my-2" />
      <FormatSwitch
        name="show-ignscan25-switch"
        onChange={() => dispatch(updateShowIGNSCAN25(!showIGNSCAN25))}
        state={showIGNSCAN25}
        icon={iconIGNSCAN25}
        label="showIGNSCAN25"
      />
      <div className="my-2" />
      <FormatSwitch
        name="show-ign-cadastres-witch"
        onChange={() => dispatch(updateShowIGNCadastre(!showIGNCadastre))}
        state={showIGNCadastre}
        icon={iconIGNCadastre}
        label="showIGNCadastre"
      />

      <div className="my-3 pb-3">
        <div className="d-flex align-item-center">
          <span className="flex-grow-1">{t('terrain3DExaggeration')}</span>
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
            onChange={(value) => dispatch(updateTerrain3DExaggeration(value as number))}
          />
        </div>
      </div>

      <FormatSwitch
        name="smoothTravel-switch"
        onChange={() => dispatch(updateSmoothTravel(!smoothTravel))}
        state={smoothTravel}
        icon=""
        label="smoothTravel"
      />
    </>
  );
};

export default MapSettingsBackgroundSwitches;
