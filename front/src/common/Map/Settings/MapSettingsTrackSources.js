import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateMapTrackSources } from 'reducers/map';
import { MAP_TRACK_SOURCES } from 'common/Map/const';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';

export default function MapSettingsTrackSources() {
  const { t } = useTranslation(['map-settings']);
  const { mapTrackSources } = useSelector((state) => state.map);
  const dispatch = useDispatch();

  const switchTrackSourceOptions = [];
  Object.entries(MAP_TRACK_SOURCES).forEach(([key]) => {
    switchTrackSourceOptions.push({
      value: key,
      label: t(`tracksources.${key}`),
    });
  });

  return (
    <SwitchSNCF
      id="tracksourceswitch"
      type={SWITCH_TYPES.inline}
      name="tracksourceswitch"
      options={switchTrackSourceOptions}
      onChange={(e) => dispatch(updateMapTrackSources(e.target.value))}
      checkedName={mapTrackSources}
    />
  );
}
