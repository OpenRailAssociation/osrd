import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { LIST_VALUES_SIGNAL_BASE } from 'applications/osrd/components/Simulation/consts';
import {
  updateMustRedraw,
  updateSpeedSpaceSettings,
  updateSignalBase,
} from 'reducers/osrdsimulation/actions';
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

    const options = LIST_VALUES_SIGNAL_BASE.map((val) => ({ value: val, label: val }));
    /**
     * Store update on toggle
     * @param {SyntheticBaseEvent} e the Event triggered by the signal UI
     */
    const toggleSignal = (e) => {
      const newSignal = e?.target?.value;
      if (typeof newSignal !== 'undefined') {
        dispatch(updateSignalBase(newSignal));
      } else {
        console.warn('Try to toggle Signal with unavailableValue');
      }
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

const OSRDSpeedSpaceChart = withOSRDData(SpeedSpaceChart);

export default OSRDSpeedSpaceChart;
