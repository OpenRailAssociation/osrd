import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { updateSpeedSpaceSettings } from 'reducers/osrdsimulation';

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

    const onSetSettings = (settings) => {
      dispatch(updateSpeedSpaceSettings(settings));
    };

    return (
      <Component {...props} onSetSettings={onSetSettings} speedSpaceSettings={speedSpaceSettings} />
    );
  };

export const OSRDSpeedSpaceSettings = withOSRDData(SpeedSpaceSettings);

export default withOSRDData;
