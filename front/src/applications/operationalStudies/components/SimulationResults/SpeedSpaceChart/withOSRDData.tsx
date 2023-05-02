import React, { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  updateSpeedSpaceSettings,
  updateTimePositionValues,
} from 'reducers/osrdsimulation/actions';
import {
  getIsPlaying,
  getPositionValues,
  getPresentSimulation,
  getSelectedTrain,
  getSpeedSpaceSettings,
  getTimePosition,
} from 'reducers/osrdsimulation/selectors';
import {
  ISpeedSpaceSettings,
  PositionValues,
  SPEED_SPACE_SETTINGS,
} from 'reducers/osrdsimulation/types';
import { TimeString } from 'common/types';
import prepareData, { GevPreparedata } from './prepareData';
import SpeedSpaceChart from './SpeedSpaceChart';

interface SpeedSpaceChartProps {
  dispatchUpdateTimePositionValues: (newTimePositionValues: TimeString) => void;
  initialHeight?: number;
  positionValues: PositionValues;
  simulationIsPlaying: boolean;
  speedSpaceSettings: ISpeedSpaceSettings;
  onSetSettings: (settingName: SPEED_SPACE_SETTINGS) => void;
  onSetChartBaseHeight?: React.Dispatch<React.SetStateAction<number>>;
  timePosition: TimeString;
  trainSimulation: GevPreparedata;
}

/**
 * HOC to provide store data
 * @param {RFC} Component
 * @returns RFC with OSRD Data. SignalSwitch
 */
const withOSRDData = (Component: (props: SpeedSpaceChartProps) => JSX.Element) =>
  function WrapperComponent(props: Partial<SpeedSpaceChartProps>) {
    const positionValues = useSelector(getPositionValues);
    const selectedTrain = useSelector(getSelectedTrain);
    const speedSpaceSettings = useSelector(getSpeedSpaceSettings);
    const timePosition = useSelector(getTimePosition);
    const simulation = useSelector(getPresentSimulation);

    const isPlaying = useSelector(getIsPlaying);

    const dispatch = useDispatch();

    const dispatchUpdateTimePositionValues = (newTimePositionValues: TimeString) => {
      dispatch(updateTimePositionValues(newTimePositionValues));
    };

    const onSetSettings = (settingName: SPEED_SPACE_SETTINGS) => {
      dispatch(
        updateSpeedSpaceSettings({
          ...speedSpaceSettings,
          [settingName]: !speedSpaceSettings[settingName],
        })
      );
    };

    // Prepare data
    const trainSimulation = useMemo(
      () => prepareData(simulation.trains[selectedTrain]),
      [simulation, selectedTrain]
    );

    return (
      <Component
        {...props}
        positionValues={positionValues}
        dispatchUpdateTimePositionValues={dispatchUpdateTimePositionValues}
        onSetSettings={onSetSettings}
        simulationIsPlaying={isPlaying}
        speedSpaceSettings={speedSpaceSettings}
        timePosition={timePosition}
        trainSimulation={trainSimulation}
      />
    );
  };

export const OSRDSpeedSpaceChart = withOSRDData(SpeedSpaceChart);

export default OSRDSpeedSpaceChart;
