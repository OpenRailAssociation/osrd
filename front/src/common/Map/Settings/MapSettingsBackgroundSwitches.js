import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  updateShowIGNBDORTHO,
  updateShowIGNCadastre,
  updateShowIGNSCAN25,
  updateShowOSM,
  updateShowOSMtracksections,
} from 'reducers/map';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import iconIGNBDORTHO from 'assets/pictures/mapbuttons/mapstyle-ortho.jpg';
import iconIGNSCAN25 from 'assets/pictures/mapbuttons/mapstyle-scan25.jpg';
import iconIGNCadastre from 'assets/pictures/mapbuttons/mapstyle-cadastre.jpg';
import iconOSM from 'assets/pictures/mapbuttons/mapstyle-normal.jpg';
import iconOSMTracks from 'assets/pictures/mapbuttons/mapstyle-osm-tracks.jpg';

export default function MapSettingsBackgroundSwitches() {
  const { t } = useTranslation(['map-settings']);
  const { showIGNBDORTHO, showIGNSCAN25, showIGNCadastre, showOSM, showOSMtracksections } =
    useSelector((state) => state.map);
  const dispatch = useDispatch();

  const formatSwitch = (name, onChange, state, icon, label) => (
    <div className="d-flex align-items-center">
      <SwitchSNCF
        id={name}
        type={SWITCH_TYPES.switch}
        name={name}
        onChange={onChange}
        checked={state}
      />
      <img className="ml-2 rounded" src={icon} alt="" height="24" />
      <span className="ml-2">{t(label)}</span>
    </div>
  );

  return (
    <>
      {formatSwitch(
        'showosmwitch',
        () => dispatch(updateShowOSM(!showOSM)),
        showOSM,
        iconOSM,
        'showOSM'
      )}
      <div className="my-2" />
      {formatSwitch(
        'showosmtracksectionswitch',
        () => dispatch(updateShowOSMtracksections(!showOSMtracksections)),
        showOSMtracksections,
        iconOSMTracks,
        'showOSMtracksections'
      )}
      <div className="my-2" />

      {formatSwitch(
        'showignbdorthoswitch',
        () => dispatch(updateShowIGNBDORTHO(!showIGNBDORTHO)),
        showIGNBDORTHO,
        iconIGNBDORTHO,
        'showIGNBDORTHO'
      )}
      <div className="my-2" />
      {formatSwitch(
        'showignscan25switch',
        () => dispatch(updateShowIGNSCAN25(!showIGNSCAN25)),
        showIGNSCAN25,
        iconIGNSCAN25,
        'showIGNSCAN25'
      )}
      <div className="my-2" />
      {formatSwitch(
        'showigncadastreswitch',
        () => dispatch(updateShowIGNCadastre(!showIGNCadastre)),
        showIGNCadastre,
        iconIGNCadastre,
        'showIGNCadastre'
      )}
    </>
  );
}
