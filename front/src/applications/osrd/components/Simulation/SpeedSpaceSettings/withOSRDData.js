import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { updateMustRedraw, updateSpeedSpaceSettings } from 'reducers/osrdsimulation';

import SpeedSpaceSettings from './SpeedSpaceSettings';

/**
 * HOC to provide store data
 * @param {RFC} Component
 * @returns RFC with OSRD Data. SignalSwitch
 */
const withOSRDData = (Component) =>
  function WrapperComponent(props) {
    const dispatch = useDispatch();
    const speedSpaceSettings = useSelector((state) => state.osrdsimulation.speedSpaceSettings);

    const toggleSetting = (settingName) => {
      dispatch(
        updateSpeedSpaceSettings({
          ...speedSpaceSettings,
          [settingName]: !speedSpaceSettings[settingName],
        })
      );
      dispatch(updateMustRedraw(true));
    };
    return <Component {...props} toggleSetting={toggleSetting} speedSpaceSettings={speedSpaceSettings} />;
  };

const OSRDSpeedSpaceSettings = withOSRDData(SpeedSpaceSettings);

export default OSRDSpeedSpaceSettings;
