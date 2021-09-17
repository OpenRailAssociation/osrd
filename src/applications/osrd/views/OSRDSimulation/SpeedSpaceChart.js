import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import { LIST_VALUES_NAME_SPEED_SPACE } from 'applications/osrd/components/Simulation/consts';
import {
  defineLinear, expandAndFormatData, formatStepsWithSpace, handleWindowResize, mergeDatasArea,
} from 'applications/osrd/components/Helpers/ChartHelpers';
import { updateMustRedraw } from 'reducers/osrdsimulation';
import defineChart from 'applications/osrd/components/Simulation/defineChart';
import drawCurve from 'applications/osrd/components/Simulation/drawCurve';
import drawArea from 'applications/osrd/components/Simulation/drawArea';
import enableInteractivity, { traceVerticalLine } from 'applications/osrd/components/Simulation/enableInteractivity';

const CHART_ID = 'SpeedSpaceChart';

const drawAxisTitle = (chart, rotate) => {
  chart.drawZone.append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('transform', rotate ? 'rotate(0)' : 'rotate(-90)')
    .attr('x', rotate ? chart.width - 10 : -10)
    .attr('y', rotate ? chart.height - 10 : 20)
    .text('KM/H');

  chart.drawZone.append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('transform', rotate ? 'rotate(-90)' : 'rotate(0)')
    .attr('x', rotate ? -10 : chart.width - 10)
    .attr('y', rotate ? 20 : chart.height - 10)
    .text('M');
};

export default function SpeedSpaceChart() {
  const dispatch = useDispatch();
  const {
    mustRedraw, positionValues, selectedTrain, simulation, timePosition,
  } = useSelector((state) => state.osrdsimulation);
  const [rotate, setRotate] = useState(false);
  const [chart, setChart] = useState(undefined);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [yPosition, setYPosition] = useState(0);
  const [isResizeActive, setResizeActive] = useState(false);
  const ref = useRef();
  const keyValues = ['position', 'speed'];

  // Prepare data
  const dataSimulation = {};
  dataSimulation.speeds = simulation.trains[selectedTrain].speeds.map(
    (step) => ({ ...step, speed: step.speed * 3.6 }),
  );
  dataSimulation.areaBlock = mergeDatasArea(dataSimulation.speeds, undefined, keyValues);
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
    dispatch(updateMustRedraw(true));
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
      drawAxisTitle(chartLocal, rotate);
      drawArea(chartLocal, 'area', dataSimulation, dispatch, 'speedSpaceChart', 'curveLinear', keyValues, 'areaBlock', rotate);
      drawCurve(chartLocal, 'speed', dataSimulation.speeds, 'speedSpaceChart', 'curveLinear', keyValues, 'speed', rotate);

      enableInteractivity(
        chartLocal, dataSimulation, dispatch, keyValues,
        LIST_VALUES_NAME_SPEED_SPACE, positionValues, rotate,
        setChart, setYPosition, setZoomLevel, yPosition, zoomLevel,
      );
      setChart(chartLocal);
      dispatch(updateMustRedraw(false));
    }
  };

  useEffect(() => {
    drawTrain();
    handleWindowResize(CHART_ID, dispatch, drawTrain, isResizeActive, setResizeActive);
  }, [chart, mustRedraw, rotate]);

  useEffect(() => {
    traceVerticalLine(
      chart, dataSimulation, keyValues,
      LIST_VALUES_NAME_SPEED_SPACE, positionValues, 'speeds', rotate, timePosition,
    );
  }, [chart, mustRedraw, timePosition]);

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
}
