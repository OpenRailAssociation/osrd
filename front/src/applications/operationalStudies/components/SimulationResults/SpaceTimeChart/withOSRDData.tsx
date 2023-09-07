import React, { ComponentType } from 'react';
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
import { persistentUpdateSimulation } from 'reducers/osrdsimulation/simulation';
import {
  time2sec,
  datetime2time,
  sec2datetime,
  time2datetime,
  datetime2Isostring,
} from 'utils/timeManipulation';
import {
  AllowancesSetting,
  Chart,
  Train,
  TrainsWithArrivalAndDepartureTimes,
} from 'reducers/osrdsimulation/types';
import { TimeString } from 'common/types';
import SpaceTimeChart, { SpaceTimeChartProps } from './SpaceTimeChart';
import {
  DispatchUpdateChart,
  DispatchUpdateDepartureArrivalTimes,
  DispatchUpdateMustRedraw,
  DispatchUpdateSelectedTrainId,
  DispatchUpdateTimePositionValues,
} from './types';

/**
 * Stdcm will automatically show ecoBlocks if exisiting. This function takes a component and returns another component that will set the forcedEcoAllowancesSettings prop on its children
 * @param {*} Component
 * @returns RFC with OSRD Data. SignalSwitch
 */
function withForcedEcoAllowanceSettings<T extends SpaceTimeChartProps>(
  Component: ComponentType<T>
): React.ComponentType<T> {
  return (props: T) => {
    const { simulation } = props;
    const forcedEcoAllowancesSettings: AllowancesSetting[] = [];
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
}

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
    const onOffsetTimeByDragging = (trains: Train[], offset: number) => {
      dispatch(persistentUpdateSimulation({ ...simulation, trains }));
      if (timePosition && offset) {
        const newTimePositionSec: number =
          time2sec(datetime2time(time2datetime(timePosition) as Date)) + offset;
        dispatch(
          updateTimePositionValues(datetime2Isostring(sec2datetime(newTimePositionSec) as Date))
        );
      }
    };

    const dispatchUpdateTimePositionValues: DispatchUpdateTimePositionValues = (
      newTimePositionValues: TimeString
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
        {...props}
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
      />
    );
  };
}

export const ForcedEcoSpaceTimeChart: React.FC<SpaceTimeChartProps> = (props) => {
  const WithOSRDData = withOSRDData(SpaceTimeChart);
  const WithForcedEcoAllowanceSettings = withForcedEcoAllowanceSettings(WithOSRDData);
  return <WithForcedEcoAllowanceSettings {...props} />;
};

const OSRDSpaceTimeChart = withOSRDData(SpaceTimeChart);
export default OSRDSpaceTimeChart;
