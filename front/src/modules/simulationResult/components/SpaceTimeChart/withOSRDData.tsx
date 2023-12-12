import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  updateMustRedraw,
  updateChart,
  updateSelectedTrainId,
  updateDepartureArrivalTimes,
} from 'reducers/osrdsimulation/actions';
import {
  getAllowancesSettings,
  getSelectedProjection,
  getPresentSimulation,
  getIsPlaying,
  getSelectedTrain,
} from 'reducers/osrdsimulation/selectors';
import { SimulationReport } from 'common/api/osrdEditoastApi';
import { persistentUpdateSimulation } from 'reducers/osrdsimulation/simulation';
import { sec2datetime, datetime2sec } from 'utils/timeManipulation';
import { Chart, TrainsWithArrivalAndDepartureTimes } from 'reducers/osrdsimulation/types';
import SpaceTimeChart, { SpaceTimeChartProps } from './SpaceTimeChart';
import {
  DispatchUpdateChart,
  DispatchUpdateDepartureArrivalTimes,
  DispatchUpdateMustRedraw,
  DispatchUpdateSelectedTrainId,
} from './types';
import { useChartSynchronizer } from '../ChartHelpers/ChartSynchronizer';

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
    const selectedTrain = useSelector(getSelectedTrain);
    // implement selector for all selected trains ids
    const selectedProjection = useSelector(getSelectedProjection);
    const simulation = useSelector(getPresentSimulation);
    const isPlaying = useSelector(getIsPlaying);

    const dispatch = useDispatch();

    const { updateTimePosition } = useChartSynchronizer();

    // Consequence of direct actions by component
    const onOffsetTimeByDragging = (
      trains: SimulationReport[],
      offset: number,
      timePosition: Date
    ) => {
      dispatch(persistentUpdateSimulation({ ...simulation, trains }));
      if (timePosition && offset) {
        const newTimePosition = sec2datetime(datetime2sec(timePosition) + offset);
        updateTimePosition(newTimePosition);
      }
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
        updateTimePosition={updateTimePosition}
        inputSelectedTrain={selectedTrain}
        // add selected trains ids
        onOffsetTimeByDragging={onOffsetTimeByDragging}
        selectedProjection={selectedProjection}
        simulation={simulation}
        simulationIsPlaying={isPlaying}
        {...props}
      />
    );
  };
}

const OSRDSpaceTimeChart = withOSRDData(SpaceTimeChart);
export default OSRDSpaceTimeChart;
