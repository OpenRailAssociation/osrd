import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  updateMustRedraw,
  updateChart,
  updateTimePositionValues,
  updateSelectedTrainId,
  updateDepartureArrivalTimes,
} from 'reducers/osrdsimulation/actions';
import {
  getAllowancesSettings,
  getPositionValues,
  getSelectedProjection,
  getTimePosition,
  getPresentSimulation,
  getIsPlaying,
  getSelectedTrain,
} from 'reducers/osrdsimulation/selectors';
import { SimulationReport } from 'common/api/osrdEditoastApi';
import { persistentUpdateSimulation } from 'reducers/osrdsimulation/simulation';
import { Chart, TrainsWithArrivalAndDepartureTimes } from 'reducers/osrdsimulation/types';
import SpaceTimeChart, { SpaceTimeChartProps } from './SpaceTimeChart';
import {
  DispatchUpdateChart,
  DispatchUpdateDepartureArrivalTimes,
  DispatchUpdateMustRedraw,
  DispatchUpdateSelectedTrainId,
  DispatchUpdateTimePositionValues,
} from './types';

/**
 * HOC to provide store data
 * @param {RFC} Component
 * @returns RFC with OSRD Data. SignalSwitch
 */
function withOSRDData<T extends SpaceTimeChartProps>(
  Component: React.ComponentType<T>
): React.ComponentType<T> {
  return (props: T) => {
    const allowancesSettings = useSelector(getAllowancesSettings);
    const positionValues = useSelector(getPositionValues);
    const selectedTrain = useSelector(getSelectedTrain);
    // implement selector for all selected trains ids
    const selectedProjection = useSelector(getSelectedProjection);
    const timePosition = useSelector(getTimePosition);
    const simulation = useSelector(getPresentSimulation);
    const isPlaying = useSelector(getIsPlaying);

    const dispatch = useDispatch();

    // Consequence of direct actions by component
    const onOffsetTimeByDragging = (trains: SimulationReport[], offset: number) => {
      dispatch(persistentUpdateSimulation({ ...simulation, trains }));
      if (timePosition && offset) {
        const newTimePosition = new Date(timePosition);
        newTimePosition.setSeconds(newTimePosition.getSeconds() + offset);
        console.log(timePosition, newTimePosition);
        dispatch(updateTimePositionValues(newTimePosition));
      }
    };

    const dispatchUpdateTimePositionValues: DispatchUpdateTimePositionValues = (
      newTimePositionValues: Date
    ) => {
      dispatch(updateTimePositionValues(newTimePositionValues));
    };

    const dispatchUpdateMustRedraw: DispatchUpdateMustRedraw = (newMustRedraw: boolean) => {
      dispatch(updateMustRedraw(newMustRedraw));
    };

    const dispatchUpdateChart: DispatchUpdateChart = (chart: Chart) => {
      dispatch(updateChart(chart));
    };

    const dispatchUpdateSelectedTrainId: DispatchUpdateSelectedTrainId = (
      _selectedTrainId: number
    ) => {
      dispatch(updateSelectedTrainId(_selectedTrainId));
    };

    const dispatchUpdateDepartureArrivalTimes: DispatchUpdateDepartureArrivalTimes = (
      newDepartureArrivalTimes: TrainsWithArrivalAndDepartureTimes[]
    ) => {
      dispatch(updateDepartureArrivalTimes(newDepartureArrivalTimes));
    };

    return (
      <Component
        allowancesSettings={allowancesSettings}
        dispatchUpdateChart={dispatchUpdateChart}
        dispatchUpdateDepartureArrivalTimes={dispatchUpdateDepartureArrivalTimes}
        dispatchUpdateMustRedraw={dispatchUpdateMustRedraw}
        dispatchUpdateSelectedTrainId={dispatchUpdateSelectedTrainId}
        dispatchUpdateTimePositionValues={dispatchUpdateTimePositionValues}
        inputSelectedTrain={selectedTrain}
        // add selected trains ids
        onOffsetTimeByDragging={onOffsetTimeByDragging}
        positionValues={positionValues}
        selectedProjection={selectedProjection}
        simulation={simulation}
        simulationIsPlaying={isPlaying}
        timePosition={timePosition}
        {...props}
      />
    );
  };
}

const OSRDSpaceTimeChart = withOSRDData(SpaceTimeChart);
export default OSRDSpaceTimeChart;
