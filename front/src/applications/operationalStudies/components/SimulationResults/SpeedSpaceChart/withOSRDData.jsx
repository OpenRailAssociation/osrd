import React, { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  updateMustRedraw,
  updateSpeedSpaceSettings,
  updateTimePositionValues,
} from 'reducers/osrdsimulation/actions';

import { getIsPlaying, getSelectedTrain } from 'reducers/osrdsimulation/selectors';

import prepareData from './prepareData';
import SpeedSpaceChart from './SpeedSpaceChart';

/**
 * HOC to provide store data
 * @param {RFC} Component
 * @returns RFC with OSRD Data. SignalSwitch
 */
const withOSRDData = (Component) =>
  function WrapperComponent(props) {
    const positionValues = useSelector((state) => state.osrdsimulation.positionValues);
    const selectedTrain = useSelector(getSelectedTrain);
    const speedSpaceSettings = useSelector((state) => state.osrdsimulation.speedSpaceSettings);
    const timePosition = useSelector((state) => state.osrdsimulation.timePosition);

    const isPlaying = useSelector(getIsPlaying);

    const dispatch = useDispatch();

    const dispatchUpdateMustRedraw = (newMustRedraw) => {
      dispatch(updateMustRedraw(newMustRedraw));
    };

    const dispatchUpdateTimePositionValues = (newTimePositionValues) => {
      dispatch(updateTimePositionValues(newTimePositionValues));
    };

    const toggleSetting = (settingName) => {
      dispatch(
        updateSpeedSpaceSettings({
          ...speedSpaceSettings,
          [settingName]: !speedSpaceSettings[settingName],
        })
      );
      dispatch(updateMustRedraw(true));
    };

    // Prepare data
    const trainSimulation = useMemo(
      () => (selectedTrain ? prepareData(selectedTrain) : null),
      [selectedTrain]
    );

    return trainSimulation ? (
      <Component
        {...props}
        trainSimulation={trainSimulation}
        dispatchUpdateMustRedraw={dispatchUpdateMustRedraw}
        dispatchUpdateTimePositionValues={dispatchUpdateTimePositionValues}
        positionValues={positionValues}
        speedSpaceSettings={speedSpaceSettings}
        timePosition={timePosition}
        toggleSetting={toggleSetting}
        simulationIsPlaying={isPlaying}
      />
    ) : null;
  };

export const OSRDSpeedSpaceChart = withOSRDData(SpeedSpaceChart);

export default OSRDSpeedSpaceChart;
