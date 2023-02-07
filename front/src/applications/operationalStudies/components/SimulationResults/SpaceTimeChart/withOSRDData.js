import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  updateMustRedraw,
  updateContextMenu,
  updateChart,
  updatePositionValues,
} from 'reducers/osrdsimulation/actions';
import {
  getAllowancesSettings,
  getMustRedraw,
  getPositionValues,
  getSelectedProjection,
  getSelectedTrain,
  getTimePosition,
  getConsolidatedSimulation,
  getPresentSimulation,
} from 'reducers/osrdsimulation/selectors';
import { persistentUpdateSimulation } from 'reducers/osrdsimulation/simulation';
import SpaceTimeChart from './SpaceTimeChart';

/**
 * HOC to provide store data
 * @param {RFC} Component
 * @returns RFC with OSRD Data. SignalSwitch
 */
const withOSRDData = (Component) =>
  function WrapperComponent(props) {
    const allowancesSettings = useSelector(getAllowancesSettings);
    const mustRedraw = useSelector(getMustRedraw);
    const positionValues = useSelector(getPositionValues);
    const selectedTrain = useSelector(getSelectedTrain);
    const selectedProjection = useSelector(getSelectedProjection);
    const timePosition = useSelector(getTimePosition);
    const simulation = useSelector(getPresentSimulation);
    const consolidatedSimulation = useSelector(getConsolidatedSimulation);

    const dispatch = useDispatch();

    // Consequence of direct actions by component
    const onOffsetTimeByDragging = (trains) => {
      dispatch(persistentUpdateSimulation({ ...simulation, trains }));
    };

    const dispatchUpdatePositionValues = (newPositionValues) => {
      dispatch(updatePositionValues(newPositionValues));
    };

    const dispatchUpdateMustRedraw = (newMustRedraw) => {
      dispatch(updateMustRedraw(newMustRedraw));
    };

    const dispatchUpdateContextMenu = (contextMenu) => {
      dispatch(updateContextMenu(contextMenu));
    };

    const dispatchUpdateChart = (chart) => {
      dispatch(updateChart(chart));
    };

    return (
      <Component
        {...props}
        allowancesSettings={allowancesSettings}
        positionValues={positionValues}
        mustRedraw={mustRedraw}
        dispatch={dispatch}
        simulation={simulation}
        selectedTrain={selectedTrain}
        selectedProjection={selectedProjection}
        timePosition={timePosition}
        consolidatedSimulation={consolidatedSimulation}
        onOffsetTimeByDragging={onOffsetTimeByDragging}
        dispatchUpdateMustRedraw={dispatchUpdateMustRedraw}
        dispatchUpdateContextMenu={dispatchUpdateContextMenu}
        dispatchUpdateChart={dispatchUpdateChart}
        dispatchUpdatePositionValues={dispatchUpdatePositionValues}
      />
    );
  };

const OSRDSpaceTimeChart = withOSRDData(SpaceTimeChart);

export default OSRDSpaceTimeChart;
