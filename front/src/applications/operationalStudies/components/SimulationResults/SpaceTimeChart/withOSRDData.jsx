import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { compose } from 'redux';

import {
  updateMustRedraw,
  updateChart,
  updatePositionValues,
  updateTimePositionValues,
  updateSelectedTrain,
  updateDepartureArrivalTimes,
} from 'reducers/osrdsimulation/actions';
import {
  getAllowancesSettings,
  getPositionValues,
  getSelectedProjection,
  getSelectedTrain,
  getTimePosition,
  getPresentSimulation,
  getIsPlaying,
} from 'reducers/osrdsimulation/selectors';
import { persistentUpdateSimulation } from 'reducers/osrdsimulation/simulation';
import { time2sec, datetime2time, sec2datetime } from 'utils/timeManipulation';
import SpaceTimeChart from './SpaceTimeChart';

/**
 * Stdcm will automatically show ecoBlocks if exisiting. This function takes a component and returns another component that will set the forcedEcoAllowancesSettings prop on its children
 * @param {*} Component
 * @returns RFC with OSRD Data. SignalSwitch
 */
const withForcedEcoAllowanceSettings = (Component) =>
  function WrapperComponent(props) {
    const { simulation } = props;
    const forcedEcoAllowancesSettings = [];
    // eslint-disable-next-line react/prop-types
    simulation?.trains?.forEach((train) => {
      forcedEcoAllowancesSettings[train.id] = train.eco?.route_aspects
        ? {
            base: true,
            baseBlocks: false,
            eco: true,
            ecoBlocks: true,
          }
        : {
            base: true,
            baseBlocks: true,
            eco: false,
            ecoBlocks: false,
          };
    });

    // Render the original component passing all props and forcedEcoAllowancesSettings as props to it
    return <Component {...props} allowancesSettings={forcedEcoAllowancesSettings} />;
  };

/**
 * HOC to provide store data
 * @param {RFC} Component
 * @returns RFC with OSRD Data. SignalSwitch
 */
const withOSRDData = (Component) =>
  function WrapperComponent(props) {
    const allowancesSettings = useSelector(getAllowancesSettings);
    const positionValues = useSelector(getPositionValues);
    const selectedTrain = useSelector(getSelectedTrain);
    // à quoi correspond selectedProjection ?
    const selectedProjection = useSelector(getSelectedProjection);
    const timePosition = useSelector(getTimePosition);
    const simulation = useSelector(getPresentSimulation);
    const isPlaying = useSelector(getIsPlaying);

    const dispatch = useDispatch();

    // Consequence of direct actions by component
    const onOffsetTimeByDragging = (trains, offset) => {
      dispatch(persistentUpdateSimulation({ ...simulation, trains }));
      if (timePosition && offset) {
        const newTimePositionSec = time2sec(datetime2time(timePosition)) + offset;

        dispatch(updateTimePositionValues(sec2datetime(newTimePositionSec)));
      }
    };

    const dispatchUpdatePositionValues = (newPositionValues) => {
      dispatch(updatePositionValues(newPositionValues));
    };

    // difference entre TimePositionValues et PositionValues (besoin cruel de typage)
    const dispatchUpdateTimePositionValues = (newTimePositionValues) => {
      dispatch(updateTimePositionValues(newTimePositionValues));
    };

    const dispatchUpdateMustRedraw = (newMustRedraw) => {
      dispatch(updateMustRedraw(newMustRedraw));
    };

    const dispatchUpdateChart = (chart) => {
      dispatch(updateChart(chart));
    };

    const dispatchUpdateSelectedTrain = (_selectedTrain) => {
      dispatch(updateSelectedTrain(_selectedTrain));
    };

    const dispatchUpdateDepartureArrivalTimes = (newDepartureArrivalTimes) => {
      dispatch(updateDepartureArrivalTimes(newDepartureArrivalTimes));
    };

    return (
      <Component
        {...props}
        allowancesSettings={allowancesSettings}
        dispatchUpdateChart={dispatchUpdateChart}
        dispatchUpdateDepartureArrivalTimes={dispatchUpdateDepartureArrivalTimes}
        dispatchUpdateMustRedraw={dispatchUpdateMustRedraw}
        dispatchUpdateSelectedTrain={dispatchUpdateSelectedTrain}
        dispatchUpdatePositionValues={dispatchUpdatePositionValues}
        dispatchUpdateTimePositionValues={dispatchUpdateTimePositionValues}
        inputSelectedTrain={selectedTrain}
        onOffsetTimeByDragging={onOffsetTimeByDragging}
        positionValues={positionValues}
        selectedProjection={selectedProjection}
        simulation={simulation}
        simulationIsPlaying={isPlaying}
        timePosition={timePosition}
      />
    );
  };

export const ForcedEcoSpaceTimeChart = compose(
  withOSRDData,
  withForcedEcoAllowanceSettings
)(SpaceTimeChart);

const OSRDSpaceTimeChart = withOSRDData(SpaceTimeChart);

export default OSRDSpaceTimeChart;
