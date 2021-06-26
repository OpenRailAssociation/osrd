import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import { LIST_VALUES_NAME_SPEED_SPACE } from 'applications/osrd/components/Simulation/consts';
import { SNCFCOLORS } from 'applications/osrd/consts';
import {
  defineLinear, expandAndFormatData, formatStepsWithSpace, handleWindowResize, mergeDatasArea,
} from 'applications/osrd/components/Helpers/ChartHelpers';
import defineChart from 'applications/osrd/components/Simulation/defineChart';
import drawCurve from 'applications/osrd/components/Simulation/drawCurve';
import drawArea from 'applications/osrd/components/Simulation/drawArea';
import enableInteractivity, { traceVerticalLine } from 'applications/osrd/components/Simulation/enableInteractivity';

const CHART_ID = 'SpeedSpaceChart';

const SpeedSpaceChart = (props) => {
  const {
    hoverPosition, mustRedraw, selectedTrain, setHoverPosition,
    setMustRedraw, simulation,
  } = props;
  const [rotate, setRotate] = useState(false);
  const [chart, setChart] = useState(undefined);
  const [isResizeActive, setResizeActive] = useState(false);
  const ref = useRef();
  const keyValues = ['space', 'value'];

  // Prepare data
  const dataSimulation = {};
  dataSimulation.speed = formatStepsWithSpace(3.6, simulation.trains[selectedTrain], 'speed');
  dataSimulation.areaBlock = mergeDatasArea(dataSimulation.speed, undefined, keyValues);
  /* dataSimulation.emergency = expandAndFormatData(
    dataSimulation.speed, simulation.trains[selectedTrain].emergency,
  );
  dataSimulation.indication = expandAndFormatData(
    dataSimulation.speed, simulation.trains[selectedTrain].indication,
  ); */

  const toggleRotation = () => {
    d3.select(`#${CHART_ID}`).remove();
    setChart({ ...chart, x: chart.y, y: chart.x });
    setRotate(!rotate);
    setMustRedraw(true);
  };

  const createChart = () => {
    d3.select(`#${CHART_ID}`).remove();

    const defineX = (chart === undefined)
      ? defineLinear(d3.max(Object.values(dataSimulation),
        (data) => d3.max(data, (d) => d[(rotate ? keyValues[1] : keyValues[0])])))
      : chart.x;
    const defineY = (chart === undefined)
      ? defineLinear(d3.max(Object.values(dataSimulation),
        (data) => d3.max(data, (d) => d[(rotate ? keyValues[0] : keyValues[1])])))
      : chart.y;

    const width = parseInt(d3.select(`#container-${CHART_ID}`).style('width'), 10);
    return defineChart(width, 250, defineX, defineY, ref, rotate, keyValues, CHART_ID);
  };

  const drawTrain = () => {
    if (mustRedraw) {
      const chartLocal = createChart();
      chartLocal.drawZone.append('g').attr('id', 'speedSpaceChart').attr('class', 'chartTrain');
      drawArea(chartLocal, 'rgba(0, 136, 207, 0.3)', dataSimulation, 'speedSpaceChart', 'curveLinear', keyValues, 'areaBlock', rotate);
      drawCurve(chartLocal, SNCFCOLORS.blue, dataSimulation, 'speedSpaceChart', 'curveLinear', keyValues, 'speed', rotate);
      // drawCurve(chartLocal, SNCFCOLORS.red, dataSimulation, 'speedSpaceChart', 'curveStepAfter', keyValues, 'emergency', rotate);
      // drawCurve(chartLocal, SNCFCOLORS.yellow, dataSimulation, 'speedSpaceChart', 'curveStepAfter', keyValues, 'indication', rotate);
      enableInteractivity(
        chartLocal, dataSimulation, keyValues,
        LIST_VALUES_NAME_SPEED_SPACE, rotate, setChart, setHoverPosition,
        setMustRedraw,
      );
      setChart(chartLocal);
      setMustRedraw(false);
    }
  };

  useEffect(() => {
    drawTrain();
    handleWindowResize(CHART_ID, drawTrain, isResizeActive, setResizeActive, setMustRedraw);
  }, [chart, mustRedraw, rotate]);

  useEffect(() => {
    traceVerticalLine(
      chart, dataSimulation, hoverPosition, keyValues, LIST_VALUES_NAME_SPEED_SPACE, 'speed', rotate,
    );
  }, [chart, mustRedraw, hoverPosition]);

  return (
    <div id={`container-${CHART_ID}`} className="speedspace-chart w-100">
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
      <button
        type="button"
        className="btn-rounded btn-rounded-white box-shadow btn-rotate"
        onClick={() => toggleRotation(rotate, setRotate)}
      >
        <i className="icons-refresh" />
      </button>
    </div>
  );
};

SpeedSpaceChart.propTypes = {
  hoverPosition: PropTypes.number,
  mustRedraw: PropTypes.bool.isRequired,
  selectedTrain: PropTypes.number.isRequired,
  setHoverPosition: PropTypes.func.isRequired,
  setMustRedraw: PropTypes.func.isRequired,
  simulation: PropTypes.object.isRequired,
};
SpeedSpaceChart.defaultProps = {
  hoverPosition: undefined,
};

export default SpeedSpaceChart;
