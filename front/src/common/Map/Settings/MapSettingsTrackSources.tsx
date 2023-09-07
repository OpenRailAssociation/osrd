import React, { FC } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { RootState } from 'reducers';
import { updateMapTrackSources } from 'reducers/map';
import { getMap } from 'reducers/map/selectors';
import { MAP_TRACK_SOURCES } from 'common/Map/const';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';

const MapSettingsTrackSources: FC<unknown> = () => {
  const { t } = useTranslation(['map-settings']);
  const { mapTrackSources } = useSelector(getMap);
  const dispatch = useDispatch();

  const switchTrackSourceOptions: Array<{ label: string; value: string }> = [];
  Object.entries(MAP_TRACK_SOURCES).forEach(([key]) => {
    switchTrackSourceOptions.push({
      value: key,
      label: t(`tracksources.${key}`).toString(),
    });
  });

  return (
    <SwitchSNCF
      id="tracksourceswitch"
      type={SWITCH_TYPES.inline}
      name="tracksourceswitch"
      options={switchTrackSourceOptions}
      onChange={(e) =>
        dispatch(updateMapTrackSources(e.target.value as RootState['map']['mapTrackSources']))
      }
      checkedName={mapTrackSources}
    />
  );
};

export default MapSettingsTrackSources;
