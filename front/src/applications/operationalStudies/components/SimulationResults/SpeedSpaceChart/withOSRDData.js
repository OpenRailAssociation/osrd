import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { updateMustRedraw, updateSpeedSpaceSettings } from 'reducers/osrdsimulation/actions';
import SpeedSpaceChart from './SpeedSpaceChart';

/**
 * HOC to provide store data
 * @param {RFC} Component
 * @returns RFC with OSRD Data. SignalSwitch
 */
const withOSRDData = (Component) =>
  function WrapperComponent(props) {
    const chartXGEV = useSelector((state) => state.osrdsimulation.chartXGEV);
    const mustRedraw = useSelector((state) => state.osrdsimulation.mustRedraw);
    const positionValues = useSelector((state) => state.osrdsimulation.positionValues);
    const selectedTrain = useSelector((state) => state.osrdsimulation.selectedTrain);
    const speedSpaceSettings = useSelector((state) => state.osrdsimulation.speedSpaceSettings);
    const timePosition = useSelector((state) => state.osrdsimulation.timePosition);
    const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
    const consolidatedSimulation = useSelector(
      (state) => state.osrdsimulation.consolidatedSimulation
    );

    const dispatch = useDispatch();

    const toggleSetting = (settingName) => {
      dispatch(
        updateSpeedSpaceSettings({
          ...speedSpaceSettings,
          [settingName]: !speedSpaceSettings[settingName],
        })
      );
      dispatch(updateMustRedraw(true));
    };

    return (
      <Component
        {...props}
        simulation={simulation}
        chartXGEV={chartXGEV}
        mustRedraw={mustRedraw}
        dispatch={dispatch}
        positionValues={positionValues}
        selectedTrain={selectedTrain}
        speedSpaceSettings={speedSpaceSettings}
        timePosition={timePosition}
        consolidatedSimulation={consolidatedSimulation}
        toggleSetting={toggleSetting}
      />
    );
  };

export const OSRDSpeedSpaceChart = withOSRDData(SpeedSpaceChart);

export default OSRDSpeedSpaceChart;
