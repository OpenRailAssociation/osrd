import React, { ComponentType, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  updateMustRedraw,
  updateSpeedSpaceSettings,
  updateTimePositionValues,
} from 'reducers/osrdsimulation/actions';

import { getIsPlaying, getSelectedTrain } from 'reducers/osrdsimulation/selectors';

import { RootState } from 'reducers';
import { SpeedSpaceSettingKey } from 'reducers/osrdsimulation/types';
import prepareData from './prepareData';
import SpeedSpaceChart from './SpeedSpaceChart';

/**
 * HOC to provide store data
 * @param {RFC} Component
 * @returns RFC with OSRD Data. SignalSwitch
 */
const withOSRDData =
  <T extends object>(Component: ComponentType<T>) =>
  (hocProps: T) => {
    const positionValues = useSelector((state: RootState) => state.osrdsimulation.positionValues);
    const selectedTrain = useSelector(getSelectedTrain);
    const speedSpaceSettings = useSelector(
      (state: RootState) => state.osrdsimulation.speedSpaceSettings
    );
    const timePosition = useSelector((state: RootState) => state.osrdsimulation.timePosition);

    const isPlaying = useSelector(getIsPlaying);

    const dispatch = useDispatch();

    const dispatchUpdateMustRedraw = (newMustRedraw: boolean) => {
      dispatch(updateMustRedraw(newMustRedraw));
    };

    const dispatchUpdateTimePositionValues = (newTimePositionValues: string) => {
      dispatch(updateTimePositionValues(newTimePositionValues));
    };

    const toggleSetting = (settingName: SpeedSpaceSettingKey) => {
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
        {...hocProps}
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
