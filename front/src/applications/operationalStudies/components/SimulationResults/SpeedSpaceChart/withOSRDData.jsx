import React, { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  updateMustRedraw,
  updateSpeedSpaceSettings,
  updateTimePositionValues,
} from 'reducers/osrdsimulation/actions';
import { getIsPlaying } from 'reducers/osrdsimulation/selectors';
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
    const selectedTrain = useSelector((state) => state.osrdsimulation.selectedTrain);
    const speedSpaceSettings = useSelector((state) => state.osrdsimulation.speedSpaceSettings);
    const timePosition = useSelector((state) => state.osrdsimulation.timePosition);
    const simulation = useSelector((state) => state.osrdsimulation.simulation.present);

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
      () => prepareData(simulation.trains[selectedTrain]),
      [simulation, selectedTrain]
    );

    return (
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
    );
  };

export const OSRDSpeedSpaceChart = withOSRDData(SpeedSpaceChart);

export default OSRDSpeedSpaceChart;
