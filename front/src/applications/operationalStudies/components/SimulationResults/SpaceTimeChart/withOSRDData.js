import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  updateMustRedraw,
  updateContextMenu,
  updateSpeedSpaceSettings,
  updateChart,
  updatePositionValues
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
import { changeTrain } from 'applications/operationalStudies/components/SimulationResults/simulationResultsHelpers';
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

    const toggleSetting = (settingName) => {
      dispatch(
        updateSpeedSpaceSettings({
          ...speedSpaceSettings,
          [settingName]: !speedSpaceSettings[settingName],
        })
      );
      dispatch(updateMustRedraw(true));
    };

    // Consequence of direct actions by component
    const onOffsetTimeByDragging = (trains) => {
      console.log('update onOffsetTimeByDragging', trains)
      dispatch(persistentUpdateSimulation({ ...simulation, trains }));
    };

    const onDragEnding = (dragEnding, setDragEnding) => {
      if (dragEnding) {
        // NO TRIGGER, use event status
        changeTrain(
          {
            departure_time: simulation.trains[selectedTrain].base.stops[0].time,
          },
          simulation.trains[selectedTrain].id
        );
        setDragEnding(false);
      }
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
        onDragEnding={onDragEnding}
        dispatchUpdateMustRedraw={dispatchUpdateMustRedraw}
        dispatchUpdateContextMenu={dispatchUpdateContextMenu}
        dispatchUpdateChart={dispatchUpdateChart}
        dispatchUpdatePositionValues={dispatchUpdatePositionValues}
      />
    );
  };

const OSRDSpaceTimeChart = withOSRDData(SpaceTimeChart);

export default OSRDSpaceTimeChart;
