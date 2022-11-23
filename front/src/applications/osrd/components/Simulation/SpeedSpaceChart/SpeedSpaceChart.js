import * as d3 from 'd3';
import { ORSD_GEV_SAMPLE_DATA } from 'applications/osrd/components/Simulation/SpeedSpaceChart/sampleData';
import React, { useEffect, useRef, useState } from 'react';

import enableInteractivity, {
  traceVerticalLine,
} from 'applications/osrd/components/Simulation/enableInteractivity';
import { updateChartXGEV, updateMustRedraw } from 'reducers/osrdsimulation';


import { CgLoadbar } from 'react-icons/cg';
import { GiResize } from 'react-icons/gi';
import { LIST_VALUES_NAME_SPEED_SPACE } from 'applications/osrd/components/Simulation/consts';
import PropTypes from 'prop-types';
import prepareData from 'applications/osrd/components/Simulation/SpeedSpaceChart/prepareData';
import {
  createChart,
  drawTrain,
} from 'applications/osrd/components/Simulation/SpeedSpaceChart/d3Helpers';
import SpeedSpaceSettings from 'applications/osrd/components/Simulation/SpeedSpaceSettings/SpeedSpaceSettings';

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

  console.log("props", props)
  const [showSettings, setShowSettings] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [resetChart, setResetChart] = useState(false);
  const [chart, setChart] = useState(undefined);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [yPosition, setYPosition] = useState(0);
  const ref = useRef();
  const keyValues = ['position', 'speed'];

  // Prepare data
  const dataSimulation = prepareData(simulation.present, selectedTrain, keyValues);

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
        undefined,
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
        undefined,
        setResetChart
      )
    );
  }, [ref, rotate]);

  // plug event handlers once the chart is ready or recreated
  useEffect(() => {
    enableInteractivity(
      chart,
      dataSimulation,
      undefined,
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
      undefined,
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
          undefined,
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
      
      <div ref={ref} className="w-100" />
      <button
        type="button"
        className="btn-rounded btn-rounded-white box-shadow btn-rotate mr-5"
        onClick={resetChartToggle}
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
  timePosition: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
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
};
