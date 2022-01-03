import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import { LIST_VALUES_NAME_SPEED_SPACE } from 'applications/osrd/components/Simulation/consts';
import {
  defineLinear, handleWindowResize, mergeDatasArea,
} from 'applications/osrd/components/Helpers/ChartHelpers';
import { updateMustRedraw } from 'reducers/osrdsimulation';
import defineChart from 'applications/osrd/components/Simulation/defineChart';
import drawCurve from 'applications/osrd/components/Simulation/drawCurve';
import drawArea from 'applications/osrd/components/Simulation/drawArea';
import enableInteractivity, { traceVerticalLine } from 'applications/osrd/components/Simulation/enableInteractivity';
import { CgLoadbar } from 'react-icons/cg';
import SpeedSpaceSettings from 'applications/osrd/components/Simulation/SpeedSpaceSettings/SpeedSpaceSettings';
import createSlopeCurve from 'applications/osrd/components/Simulation/SpeedSpaceChart/createSlopeCurve';

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

export default function SpeedSpaceChart(props) {
  const { heightOfSpeedSpaceChart } = props;
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
  dataSimulation.speed = simulation.trains[selectedTrain].base.speeds.map(
    (step) => ({ ...step, speed: step.speed * 3.6 }),
  );
  if (simulation.trains[selectedTrain].margins && !simulation.trains[selectedTrain].margins.error) {
    dataSimulation.margins_speed = simulation.trains[selectedTrain].margins.speeds.map(
      (step) => ({ ...step, speed: step.speed * 3.6 }),
    );
  }
  if (simulation.trains[selectedTrain].eco && !simulation.trains[selectedTrain].eco.error) {
    dataSimulation.eco_speed = simulation.trains[selectedTrain].eco.speeds.map(
      (step) => ({ ...step, speed: step.speed * 3.6 }),
    );
  }
  dataSimulation.areaBlock = mergeDatasArea(dataSimulation.speed, undefined, keyValues);
  dataSimulation.vmax = simulation.trains[selectedTrain].vmax.map(
    (step) => ({ speed: step.speed * 3.6, position: step.position }),
  );

  // Slopes
  dataSimulation.slopesHistogram = simulation.trains[selectedTrain].slopes.map(
    (step) => ({ position: step.position, gradient: step.gradient * 2 }),
  );
  dataSimulation.slopesCurve = createSlopeCurve(
    simulation.trains[selectedTrain].slopes, dataSimulation.speed,
  );

  // Curves
  dataSimulation.curvesHistogram = simulation.trains[selectedTrain].curves.map(
    (step) => ({ position: step.position, radius: step.radius }),
  );
  console.log(dataSimulation.curvesHistogram);

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
        (data) => d3.max(data, (d) => d[(rotate ? keyValues[1] : keyValues[0])] + 100)))
      : chart.x;
    const defineY = (chart === undefined)
      ? defineLinear(d3.max(Object.values(dataSimulation),
        (data) => d3.max(data, (d) => d[(rotate ? keyValues[0] : keyValues[1])] + 50)))
      : chart.y;

    const width = parseInt(d3.select(`#container-${CHART_ID}`).style('width'), 10);
    return defineChart(
      width, heightOfSpeedSpaceChart, defineX, defineY, ref, rotate, keyValues, CHART_ID,
    );
  };

  const drawOPs = (chartLocal) => {
    const operationalPointsZone = chartLocal.drawZone.append('g').attr('id', 'gev-operationalPointsZone');
    simulation.trains[selectedTrain].base.stops.forEach((stop) => {
      operationalPointsZone.append('line')
        .datum(stop.position)
        .attr('id', `op-${stop.id}`)
        .attr('class', 'op-line')
        .attr('x1', rotate ? 0 : (d) => chartLocal.x(d))
        .attr('y1', rotate ? (d) => chartLocal.y(d) : chartLocal.height)
        .attr('x2', rotate ? chartLocal.width : (d) => chartLocal.x(d))
        .attr('y2', rotate ? (d) => chartLocal.y(d) : 0);
      operationalPointsZone.append('text')
        .datum(stop.position)
        .attr('class', 'op-text')
        .text(`${stop.name}`)
        .attr('x', rotate ? 0 : (d) => chartLocal.x(d))
        .attr('y', rotate ? (d) => chartLocal.y(d) : chartLocal.height)
        .attr('text-anchor', 'center')
        .attr('transform', `rotate(0 ${chartLocal.x(stop.position)}, ${chartLocal.height})`)
        .attr('dx', 5)
        .attr('dy', rotate ? -5 : 15 - chartLocal.height);
    });
  };

  const drawTrain = () => {
    if (mustRedraw) {
      const chartLocal = createChart();
      chartLocal.drawZone.append('g').attr('id', 'speedSpaceChart').attr('class', 'chartTrain');
      drawAxisTitle(chartLocal, rotate);
      drawArea(chartLocal, 'area', dataSimulation, dispatch, 'speedSpaceChart', 'curveLinear', keyValues, 'areaBlock', rotate);
      drawCurve(chartLocal, 'speed', dataSimulation.speed, 'speedSpaceChart', 'curveLinear', keyValues, 'speed', rotate);
      if (dataSimulation.margins_speed) {
        drawCurve(chartLocal, 'speed margins', dataSimulation.margins_speed, 'speedSpaceChart', 'curveLinear', keyValues, 'margins_speed', rotate);
      }
      if (dataSimulation.eco_speed) {
        drawCurve(chartLocal, 'speed eco', dataSimulation.eco_speed, 'speedSpaceChart', 'curveLinear', keyValues, 'eco_speed', rotate);
      }
      if (dataSimulation.vmax) {
        drawCurve(chartLocal, 'speed vmax', dataSimulation.vmax, 'speedSpaceChart', 'curveLinear', keyValues, 'vmax', rotate);
      }
      if (dataSimulation.slopesCurve) {
        drawCurve(chartLocal, 'speed slopes', dataSimulation.slopesCurve, 'speedSpaceChart', 'curveLinear', ['position', 'height'], 'slopes', rotate);
      }
      if (dataSimulation.slopesHistogram) {
        drawCurve(chartLocal, 'speed slopesHistogram', dataSimulation.slopesHistogram, 'speedSpaceChart', 'curveLinear', ['position', 'gradient'], 'slopesHistogram', rotate);
      }
      if (dataSimulation.curvesHistogram) {
        drawCurve(chartLocal, 'speed curvesHistogram', dataSimulation.curvesHistogram, 'speedSpaceChart', 'curveLinear', ['position', 'radius'], 'curvesHistogram', rotate);
      }

      // Operational points
      drawOPs(chartLocal);

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
      LIST_VALUES_NAME_SPEED_SPACE, positionValues, 'speed', rotate, timePosition,
    );
  }, [chart, mustRedraw, positionValues, timePosition]);

  return (
    <div id={`container-${CHART_ID}`} className="speedspace-chart w-100" style={{ height: `${heightOfSpeedSpaceChart}px` }}>
      <SpeedSpaceSettings />
      <div ref={ref} />
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
  heightOfSpeedSpaceChart: PropTypes.number.isRequired,
};
