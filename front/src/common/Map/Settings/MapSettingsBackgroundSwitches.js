import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateShowOrthoPhoto, updateShowOSM, updateShowOSMtracksections } from 'reducers/map';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import iconOrthoPhoto from 'assets/pictures/mapstyle-ortho.jpg';
import iconOSM from 'assets/pictures/mapstyle-normal.jpg';
import iconOSMTracks from 'assets/pictures/mapstyle-osm-tracks.jpg';

export default function MapSettingsBackgroundSwitches() {
  const { t } = useTranslation(['map-settings']);
  const { showOrthoPhoto, showOSM, showOSMtracksections } = useSelector((state) => state.map);
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
      <img className="ml-2 rounded" src={icon} alt="" height="20" />
      <span className="ml-2">{t(label)}</span>
    </div>
  );

  return (
    <div className="row">
      <div className="col-xl-6">
        {formatSwitch(
          'showosmwitch',
          () => dispatch(updateShowOSM(!showOSM)),
          showOSM,
          iconOSM,
          'showOSM'
        )}
        <div className="my-1" />
        {formatSwitch(
          'showosmtracksectionswitch',
          () => dispatch(updateShowOSMtracksections(!showOSMtracksections)),
          showOSMtracksections,
          iconOSMTracks,
          'showOSMtracksections'
        )}
      </div>
      <div className="col-xl-6 mt-1 mt-xl-0">
        {formatSwitch(
          'showorthophotoswitch',
          () => dispatch(updateShowOrthoPhoto(!showOrthoPhoto)),
          showOrthoPhoto,
          iconOrthoPhoto,
          'showOrthoPhoto'
        )}
      </div>
    </div>
  );
}
