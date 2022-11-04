import * as d3 from 'd3';
import { ORSD_GEV_SAMPLE_DATA } from 'applications/osrd/components/Simulation/SpeedSpaceChart/sampleData';
import React, { useEffect, useRef, useState } from 'react';

import enableInteractivity, {
  traceVerticalLine,
} from 'applications/osrd/components/Simulation/enableInteractivity';
import { updateChartXGEV, updateMustRedraw } from 'reducers/osrdsimulation';
import { useDispatch, useSelector } from 'react-redux';

import { CgLoadbar } from 'react-icons/cg';
import { GiResize } from 'react-icons/gi';
import { LIST_VALUES_NAME_SPEED_SPACE } from 'applications/osrd/components/Simulation/consts';
import PropTypes from 'prop-types';
import prepareData from 'applications/osrd/components/Simulation/SpeedSpaceChart/prepareData';
import {
  createChart,
  drawTrain,
} from 'applications/osrd/components/Simulation/SpeedSpaceChart/d3Helpers';
import OSRDSpeedSpaceSettings from 'applications/osrd/components/Simulation/SpeedSpaceSettings/withOSRDData';

const CHART_ID = 'SpeedSpaceChart';

export default function SpeedSpaceChart(props) {
  const {
    heightOfSpeedSpaceChart,
    simulation,
    chartXGEV,
    mustRedraw,
    positionValues,
    selectedTrain,
    speedSpaceSettings,
    timePosition,
    consolidatedSimulation,
  } = props;
  const dispatch = useDispatch();

  const [showSettings, setShowSettings] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [resetChart, setResetChart] = useState(false);
  const [chart, setChart] = useState(undefined);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [yPosition, setYPosition] = useState(0);
  const [isResizeActive, setResizeActive] = useState(false);
  const ref = useRef();
  const keyValues = ['position', 'speed'];

  // Prepare data
  const dataSimulation = prepareData(simulation, selectedTrain, keyValues);

  const toggleRotation = () => {
    d3.select(`#${CHART_ID}`).remove();
    setChart({ ...chart, x: chart.y, y: chart.x });
    setRotate(!rotate);
    dispatch(updateMustRedraw(true));
  };

  const resetChartToggle = () => {
    d3.select(`#${CHART_ID}`).remove();

    setRotate(false);
    setChart(
      createChart(
        CHART_ID,
        undefined,
        resetChart,
        dataSimulation,
        false,
        keyValues,
        heightOfSpeedSpaceChart,
        ref,
        dispatch,
        setResetChart
      )
    );
  };

  useEffect(() => {
    setChart(
      createChart(
        CHART_ID,
        chart,
        resetChart,
        dataSimulation,
        rotate,
        keyValues,
        heightOfSpeedSpaceChart,
        ref,
        dispatch,
        setResetChart
      )
    );

    //handleWindowResize(CHART_ID, dispatch, drawTrain, isResizeActive, setResizeActive);
  }, [ref, rotate]);

  // plug event handlers once the chart is ready
  useEffect(() => {

    enableInteractivity(
      chart,
      dataSimulation,
      dispatch,
      keyValues,
      LIST_VALUES_NAME_SPEED_SPACE,
      positionValues,
      rotate,
      setChart,
      setYPosition,
      setZoomLevel,
      yPosition,
      zoomLevel
    );
    //handleWindowResize(CHART_ID, dispatch, drawTrain, isResizeActive, setResizeActive);
  }, [chart]);

  // redraw the trains is necessary
  useEffect(() => {
    drawTrain(
      LIST_VALUES_NAME_SPEED_SPACE,
      simulation,
      selectedTrain,
      dataSimulation,
      keyValues,
      positionValues,
      rotate,
      speedSpaceSettings,
      mustRedraw,
      setChart,
      setYPosition,
      setZoomLevel,
      yPosition,
      dispatch,
      zoomLevel,
      CHART_ID,
      chart,
      resetChart,
      heightOfSpeedSpaceChart,
      ref,
      setResetChart,
      true
    );
    //handleWindowResize(CHART_ID, dispatch, drawTrain, isResizeActive, setResizeActive);
  }, [chart, mustRedraw, rotate, consolidatedSimulation]);


  useEffect(() => {
    traceVerticalLine(
      chart,
      dataSimulation,
      keyValues,
      LIST_VALUES_NAME_SPEED_SPACE,
      positionValues,
      'speed',
      rotate,
      timePosition
    );
  }, [chart, mustRedraw, positionValues, timePosition]);

  useEffect(() => {
    if (chartXGEV) {
      setChart({ ...chart, x: chartXGEV });
    }
  }, [chartXGEV]);

  /*
  onClick={() => {
          setResetChart(true);
          dispatch(updateMustRedraw(true));
        }}*/


  return (
    <div
      id={`container-${CHART_ID}`}
      className="speedspace-chart w-100"
      style={{ height: `${heightOfSpeedSpaceChart}px` }}
    >
      <button
        type="button"
        className="showSettingsButton"
        onClick={() => setShowSettings(!showSettings)}
      >
        <i className={showSettings ? 'icons-arrow-prev' : 'icons-arrow-next'} />
      </button>
      <OSRDSpeedSpaceSettings showSettings={showSettings} />
      <div ref={ref} className="w-100" />
      <button
        type="button"
        className="btn-rounded btn-rounded-white box-shadow btn-rotate mr-5"
        onClick = {resetChartToggle}
      >
        <GiResize />
      </button>
      <button
        type="button"
        className="btn-rounded btn-rounded-white box-shadow btn-rotate"
        onClick={() => toggleRotation(rotate, setRotate)}
      >
        <i className="icons-refresh" />
      </button>
      <div className="handle-tab-resize">
        <CgLoadbar />
      </div>
    </div>
  );
}

SpeedSpaceChart.propTypes = {
  heightOfSpeedSpaceChart: PropTypes.number,
  simulation: PropTypes.object,
  chartXGEV: PropTypes.func,
  mustRedraw: PropTypes.bool,
  positionValues: PropTypes.object,
  selectedTrain: PropTypes.number,
  speedSpaceSettings: PropTypes.object,
  timePosition: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.instanceOf(Date)
  ]),
  consolidatedSimulation: PropTypes.array,
};

SpeedSpaceChart.defaultProps = {
  heightOfSpeedSpaceChart: 250,
  simulation: ORSD_GEV_SAMPLE_DATA.simulation,
  chartXGEV: undefined,
  mustRedraw: ORSD_GEV_SAMPLE_DATA.mustRedraw,
  positionValues: ORSD_GEV_SAMPLE_DATA.positionValues,
  selectedTrain: ORSD_GEV_SAMPLE_DATA.selectedTrain,
  speedSpaceSettings: ORSD_GEV_SAMPLE_DATA.speedSpaceSettings,
  timePosition: ORSD_GEV_SAMPLE_DATA.timePosition,
  consolidatedSimulation: ORSD_GEV_SAMPLE_DATA.consolidatedSimulation,
}


