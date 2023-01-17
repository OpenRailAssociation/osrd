import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';
import { CgLoadbar } from 'react-icons/cg';
import { GiResize } from 'react-icons/gi';
import PropTypes from 'prop-types';
import enableInteractivity, {
  traceVerticalLine,
} from 'applications/osrd/components/Simulation/enableInteractivity';
import { LIST_VALUES_NAME_SPEED_SPACE } from 'applications/osrd/components/Simulation/consts';
import prepareData from 'applications/osrd/components/Simulation/SpeedSpaceChart/prepareData';
import {
  createChart,
  drawTrain,
} from 'applications/osrd/components/Simulation/SpeedSpaceChart/d3Helpers';
import SpeedSpaceSettings from 'applications/osrd/components/Simulation/SpeedSpaceSettings/SpeedSpaceSettings';
import ORSD_GEV_SAMPLE_DATA from './sampleData';

const CHART_ID = 'SpeedSpaceChart';
/**
 * A chart to see the evolution of speed of one train on its journey
 * Features:
 * - One train only (current selected)
 * - Vertical line to the current position
 * - 2 marchs displayed: base and alternative
 *
 */ export default function SpeedSpaceChart(props) {
  const {
    heightOfSpeedSpaceChart,
    simulation,
    chartXGEV,
    dispatch,
    mustRedraw,
    positionValues,
    selectedTrain,
    speedSpaceSettings,
    timePosition,
    consolidatedSimulation,
    toggleSetting,
  } = props;

  const [showSettings, setShowSettings] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [resetChart, setResetChart] = useState(false);
  const [chart, setChart] = useState(undefined);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [yPosition, setYPosition] = useState(0);
  const ref = useRef();
  const keyValues = ['position', 'speed'];

  // Prepare data
  const dataSimulation = prepareData(simulation, selectedTrain, keyValues);

  // rotation Handle (button on right bottom)
  const toggleRotation = () => {
    d3.select(`#${CHART_ID}`).remove();
    setChart({
      ...chart,
      x: chart.y,
      y: chart.x,
      originalScaleX: chart.originalScaleY,
      originalScaleY: chart.originalScaleX,
    });
    setRotate(!rotate);
  };

  // Reset Chart Handle (first button on right bottom)
  const resetChartToggle = () => {
    d3.select(`#${CHART_ID}`).remove();
    setRotate(false);
    setChart(
      createChart(
        CHART_ID,
        chart,
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

  // in case of initial ref creation of rotate, recreate the chart
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
  }, [ref, rotate, heightOfSpeedSpaceChart]);

  // plug event handlers once the chart is ready or recreated
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
  }, [chart, mustRedraw, rotate, consolidatedSimulation]);

  // draw or redraw the position line indictator when usefull
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

  // set the window resize event manager
  useEffect(() => {
    let timeOutFunctionId;
    const resizeDrawTrain = () => {
      d3.select(`#${CHART_ID}`).remove();
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
    };
    const timeOutResize = () => {
      clearTimeout(timeOutFunctionId);
      timeOutFunctionId = setTimeout(resizeDrawTrain, 500);
    };
    window.addEventListener('resize', timeOutResize);
  }, []);

  // reset chart
  useEffect(() => resetChartToggle(), [resetChart]);

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
      <SpeedSpaceSettings
        showSettings={showSettings}
        toggleSetting={toggleSetting}
        SpeedSpaceSettings={speedSpaceSettings}
      />
      <div ref={ref} className="w-100" />
      <button
        type="button"
        className="btn-rounded btn-rounded-white box-shadow btn-rotate mr-5"
        onClick={() => setResetChart(true)}
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
  /**
   * height of chart
   */
  heightOfSpeedSpaceChart: PropTypes.number,
  /**
   * current simulation (selected train) ! to be removed
   */
  simulation: PropTypes.object,
  /**
   * Current X linear scale for synced charts
   */
  chartXGEV: PropTypes.func,
  /**
   * Dispath to store func
   */
  dispatch: PropTypes.func,
  /**
   * Force d3 render trigger ! To be removed
   */
  mustRedraw: PropTypes.bool,
  /**
   * Current Position to be showed (vertical line)
   */
  positionValues: PropTypes.object,
  /**
   * Current Selected Train index
   */
  selectedTrain: PropTypes.number,
  /**
   * Chart settings
   */
  speedSpaceSettings: PropTypes.object,
  /**
   * Current Time Position to be showed (vertical line)
   */
  timePosition: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  /**
   * Current Simulation with more data (for current train)
   */
  consolidatedSimulation: PropTypes.array,
  /**
   * Toggle the Settings div ! Not isolated
   */
  toggleSetting: PropTypes.func,
};

SpeedSpaceChart.defaultProps = {
  heightOfSpeedSpaceChart: 250,
  simulation: ORSD_GEV_SAMPLE_DATA.simulation.present,
  chartXGEV: undefined,
  dispatch: () => {},
  mustRedraw: ORSD_GEV_SAMPLE_DATA.mustRedraw,
  positionValues: ORSD_GEV_SAMPLE_DATA.positionValues,
  selectedTrain: ORSD_GEV_SAMPLE_DATA.selectedTrain,
  speedSpaceSettings: ORSD_GEV_SAMPLE_DATA.speedSpaceSettings,
  timePosition: ORSD_GEV_SAMPLE_DATA.timePosition,
  consolidatedSimulation: ORSD_GEV_SAMPLE_DATA.consolidatedSimulation,
  toggleSetting: () => {},
};
