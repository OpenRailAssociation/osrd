import * as d3 from 'd3';

import React, { useEffect, useRef, useState } from 'react';
import { traceVerticalLine } from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/enableInteractivity';
import { Rnd } from 'react-rnd';
import {
  interpolateOnTime,
  timeShiftTrain,
} from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/ChartHelpers';
import ORSD_GET_SAMPLE_DATA from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/sampleData';
import { CgLoadbar } from 'react-icons/cg';
import ChartModal from 'applications/operationalStudies/components/SimulationResults/ChartModal';
import { GiResize } from 'react-icons/gi';
import { LIST_VALUES_NAME_SPACE_TIME } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import PropTypes from 'prop-types';
import createTrain from 'applications/operationalStudies/components/SimulationResults/SpaceTimeChart/createTrain';

import { useTranslation } from 'react-i18next';

import { drawAllTrains } from 'applications/operationalStudies/components/SimulationResults/SpaceTimeChart/d3Helpers';

const CHART_ID = 'SpaceTimeChart';
const CHART_MIN_HEIGHT = 250;

/**
 * @summary A Important chart to study evolution of trains vs time and inside block occupancies
 *
 * @version 1.0
 *
 * Features:
 * - Possible to slide a train and update its departure time
 * - Type " + " or " - " to update departure time by second
 * - use ctrl + third mouse button to zoom it / out
 * - use shift + hold left mouse button to pan
 * - Right-Bottom bottom to switch Scales
 * - Resize vertically
 *
 */
export default function SpaceTimeChart(props) {
  const ref = useRef();
  const { t } = useTranslation(['allowances']);
  const {
    allowancesSettings,
    positionValues,
    selectedProjection,
    initialSelectedTrain,
    timePosition,
    simulation,
    dispatch,
    onOffsetTimeByDragging,
    onSetBaseHeightOfSpaceTimeChart,
    dispatchUpdateMustRedraw,
    dispatchUpdatePositionValues,
    dispatchUpdateChart,
    dispatchUpdateContextMenu,
    initialHeightOfSpaceTimeChart,
  } = props;

  const keyValues = ['time', 'position'];
  const [rotate, setRotate] = useState(false);
  const [chart, setChart] = useState(undefined);
  const [resetChart, setResetChart] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [yPosition, setYPosition] = useState(0);
  const [dataSimulation, setDataSimulation] = useState(undefined);
  const [showModal, setShowModal] = useState('');
  const [dragOffset, setDragOffset] = useState(0);
  const [dragEnding, setDragEnding] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState(initialSelectedTrain);
  const [heightOfSpaceTimeChart, setHeightOfSpaceTimeChart] = useState(
    initialHeightOfSpaceTimeChart
  );

  const [baseHeightOfSpaceTimeChart, setBaseHeightOfSpaceTimeChart] =
    useState(heightOfSpaceTimeChart);

  const handleKey = ({ key }) => {
    if (['+', '-'].includes(key)) {
      setShowModal(key);
    }
  };

  // ACTIONS

  // Everything should be done by Hoc, has no direct effect on Comp behavior
  const offsetTimeByDragging = (offset) => {
    if (dataSimulation) {
      const trains = Array.from(dataSimulation.trains);
      trains[selectedTrain] = timeShiftTrain(trains[selectedTrain], offset);
      setDataSimulation({ ...simulation, trains });
      onOffsetTimeByDragging(trains);
    }
  };

  const toggleRotation = () => {
    d3.select(`#${CHART_ID}`).remove();
    setChart({ ...chart, x: chart.y, y: chart.x });
    setRotate(!rotate);
    drawAllTrains(
      false,
      dataSimulation,
      false,
      chart,
      heightOfSpaceTimeChart,
      keyValues,
      ref,
      rotate,
      dispatch,
      CHART_ID,
      simulation,
      selectedTrain,
      positionValues,
      setChart,
      setResetChart,
      setYPosition,
      setZoomLevel,
      setDragEnding,
      setDragOffset,
      yPosition,
      zoomLevel,
      selectedProjection,
      dispatchUpdateMustRedraw,
      dispatchUpdateChart,
      dispatchUpdateContextMenu,
      allowancesSettings,
      offsetTimeByDragging,
      setSelectedTrain,
      false
    );
  };

  useEffect(() => {
    offsetTimeByDragging(dragOffset);
  }, [dragOffset]);

  useEffect(() => {
    const trains = dataSimulation?.trains || simulation.trains;
    const newDataSimulation = createTrain(dispatch, keyValues, trains, t);

    if (newDataSimulation) {
      drawAllTrains(
        resetChart,
        newDataSimulation,
        false,
        chart,
        heightOfSpaceTimeChart,
        keyValues,
        ref,
        rotate,
        dispatch,
        CHART_ID,
        simulation,
        selectedTrain,
        positionValues,
        setChart,
        setResetChart,
        setYPosition,
        setZoomLevel,
        setDragEnding,
        setDragOffset,
        yPosition,
        zoomLevel,
        selectedProjection,
        dispatchUpdateMustRedraw,
        dispatchUpdateChart,
        dispatchUpdateContextMenu,
        allowancesSettings,
        offsetTimeByDragging,
        setSelectedTrain,
        true
      );

      // Reprogram !
      // handleWindowResize(CHART_ID, dispatch, drawAllTrains, isResizeActive, setResizeActive);
    }
  }, [rotate, selectedTrain, dataSimulation, heightOfSpaceTimeChart, dispatchUpdateMustRedraw]);

  // ADN: trigger a redraw on every simulation change. This is the right pattern.
  useEffect(() => {
    setDataSimulation(simulation);
  }, [simulation.trains]);

  useEffect(() => {
    if (timePosition && dataSimulation && dataSimulation[selectedTrain]) {
      // ADN: too heavy, dispatch on release (dragEnd), careful with dispatch !
      const newPositionValues = interpolateOnTime(
        dataSimulation[selectedTrain],
        keyValues,
        LIST_VALUES_NAME_SPACE_TIME,
        timePosition
      );
      dispatchUpdatePositionValues(newPositionValues);
    }
  }, [chart]);

  useEffect(() => {
    if (dataSimulation) {
      traceVerticalLine(
        chart,
        dataSimulation[selectedTrain],
        keyValues,
        LIST_VALUES_NAME_SPACE_TIME,
        positionValues,
        'headPosition',
        rotate,
        timePosition
      );
    }
  }, [positionValues]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <Rnd
      default={{
        x: 0,
        y: 0,
        width: '100%',
        height: `${heightOfSpaceTimeChart}px`,
      }}
      minHeight={CHART_MIN_HEIGHT}
      disableDragging
      enableResizing={{
        bottom: true,
      }}
      onResizeStart={() => {
        setBaseHeightOfSpaceTimeChart(heightOfSpaceTimeChart);
        onSetBaseHeightOfSpaceTimeChart(heightOfSpaceTimeChart);
      }}
      onResize={(_e, _dir, _refToElement, delta) => {
        setHeightOfSpaceTimeChart(baseHeightOfSpaceTimeChart + delta.height);
        onSetBaseHeightOfSpaceTimeChart(baseHeightOfSpaceTimeChart + delta.height);
      }}
      onResizeStop={() => {
        dispatchUpdateMustRedraw(true);
      }}
    >
      <div
        id={`container-${CHART_ID}`}
        className="spacetime-chart w-100"
        style={{ height: `${heightOfSpaceTimeChart}px` }}
      >
        {showModal !== '' ? (
          <ChartModal
            type={showModal}
            setShowModal={setShowModal}
            trainName={dataSimulation?.trains[selectedTrain]?.name}
            offsetTimeByDragging={offsetTimeByDragging}
          />
        ) : null}
        <div ref={ref} />
        <button
          type="button"
          className="btn-rounded btn-rounded-white box-shadow btn-rotate"
          onClick={() => toggleRotation(rotate, setRotate, dataSimulation)}
        >
          <i className="icons-refresh" />
        </button>
        <button
          type="button"
          className="btn-rounded btn-rounded-white box-shadow btn-rotate mr-5"
          onClick={() => {
            setResetChart(true);
            dispatchUpdateMustRedraw(true);
          }}
        >
          <GiResize />
        </button>
        <div className="handle-tab-resize">
          <CgLoadbar />
        </div>
      </div>
    </Rnd>
  );
}

SpaceTimeChart.propTypes = {
  allowancesSettings: PropTypes.any,
  positionValues: PropTypes.any,
  selectedProjection: PropTypes.any.isRequired,
  initialSelectedTrain: PropTypes.any,
  timePosition: PropTypes.any,
  simulation: PropTypes.any,
  dispatch: PropTypes.any,
  onOffsetTimeByDragging: PropTypes.func,
  onSetBaseHeightOfSpaceTimeChart: PropTypes.any,
  dispatchUpdateMustRedraw: PropTypes.func,
  dispatchUpdatePositionValues: PropTypes.any,
  dispatchUpdateChart: PropTypes.any,
  dispatchUpdateContextMenu: PropTypes.any,
  initialHeightOfSpaceTimeChart: PropTypes.any.isRequired,
};

SpaceTimeChart.defaultProps = {
  simulation: ORSD_GET_SAMPLE_DATA.simulation.present,
  allowancesSettings: ORSD_GET_SAMPLE_DATA.allowancesSettings,
  dispatch: () => {},
  positionValues: ORSD_GET_SAMPLE_DATA.positionValues,
  initialSelectedTrain: ORSD_GET_SAMPLE_DATA.selectedTrain,
  timePosition: ORSD_GET_SAMPLE_DATA.timePosition,
  onOffsetTimeByDragging: () => {},
  onSetBaseHeightOfSpaceTimeChart: () => {},
  dispatchUpdateMustRedraw: () => {},
  dispatchUpdateChart: () => {},
  dispatchUpdatePositionValues: () => {},
  dispatchUpdateContextMenu: () => {},
};
