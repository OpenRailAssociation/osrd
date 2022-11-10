import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateShowOrthoPhoto } from 'reducers/map';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';

export default function MapSettingsShowOrthoPhoto() {
  const { t } = useTranslation(['map-settings']);
  const { showOrthoPhoto } = useSelector((state) => state.map);
  const dispatch = useDispatch();

  return (
    <div className="d-flex align-items-center">
      <SwitchSNCF
        id="showorthophotoswitch"
        type={SWITCH_TYPES.switch}
        name="showorthophotoswitch"
        onChange={() => dispatch(updateShowOrthoPhoto(!showOrthoPhoto))}
        checked={showOrthoPhoto}
      />
      <span className="ml-2">{t('showOrthoPhoto')}</span>
    </div>
  );
}
