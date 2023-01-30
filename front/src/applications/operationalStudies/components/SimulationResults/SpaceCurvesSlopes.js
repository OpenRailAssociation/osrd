import * as d3 from 'd3';

import React, { useEffect, useRef, useState } from 'react';
import {
  defineLinear,
  handleWindowResize,
  mergeDatasAreaConstant,
} from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/ChartHelpers';
import enableInteractivity, {
  traceVerticalLine,
} from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/enableInteractivity';
import { useDispatch, useSelector } from 'react-redux';

import { CgLoadbar } from 'react-icons/cg';
import { LIST_VALUES_NAME_SPACE_CURVES_SLOPES } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import PropTypes from 'prop-types';
import createCurveCurve from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/createCurveCurve';
import createSlopeCurve from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/createSlopeCurve';
import defineChart from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/defineChart';
import drawArea from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/drawArea';
import drawCurve from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/drawCurve';
import { updateMustRedraw } from 'reducers/osrdsimulation/actions';

const CHART_ID = 'SpaceCurvesSlopes';

const drawAxisTitle = (chart, rotate) => {
  chart.drawZone
    .append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('transform', rotate ? 'rotate(0)' : 'rotate(-90)')
    .attr('x', rotate ? chart.width - 10 : -10)
    .attr('y', rotate ? chart.height - 10 : 20)
    .text('M/KM');

  chart.drawZone
    .append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('transform', rotate ? 'rotate(-90)' : 'rotate(0)')
    .attr('x', rotate ? -10 : chart.width - 10)
    .attr('y', rotate ? 20 : chart.height - 10)
    .text('M');
};

export default function SpaceCurvesSlopes(props) {
  const { heightOfSpaceCurvesSlopesChart } = props;
  const dispatch = useDispatch();
  const { chartXGEV, mustRedraw, positionValues, selectedTrain, timePosition } = useSelector(
    (state) => state.osrdsimulation
  );
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  // eslint-disable-next-line no-unused-vars
  const [rotate, setRotate] = useState(false);
  const [chart, setChart] = useState(undefined);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [yPosition, setYPosition] = useState(0);
  const [isResizeActive, setResizeActive] = useState(false);
  const ref = useRef();
  const keyValues = ['position', 'gradient'];

  // Prepare data
  const dataSimulation = {};
  // Speeds : reference needed for interpolate position of cursor
  dataSimulation.speed = simulation.trains[selectedTrain].base.speeds.map((step) => ({
    ...step,
    speed: step.speed * 3.6,
  }));
  // Slopes
  dataSimulation.slopesHistogram = simulation.trains[selectedTrain].slopes.map((step) => ({
    position: step.position,
    gradient: step.gradient,
  }));
  dataSimulation.areaSlopesHistogram = mergeDatasAreaConstant(dataSimulation.slopesHistogram, 0, [
    'position',
    'gradient',
  ]);
  dataSimulation.slopesCurve = createSlopeCurve(
    simulation.trains[selectedTrain].slopes,
    dataSimulation.slopesHistogram,
    'gradient'
  );
  // Curves
  dataSimulation.curvesHistogram = createCurveCurve(
    simulation.trains[selectedTrain].curves,
    dataSimulation.slopesHistogram,
    'gradient'
  );

  const createChart = () => {
    d3.select(`#${CHART_ID}`).remove();

    const defineX =
      chart === undefined
        ? defineLinear(
            d3.max(
              dataSimulation.slopesHistogram,
              (d) => d[rotate ? keyValues[1] : keyValues[0]] + 100
            )
          )
        : chart.x;
    const defineY =
      chart === undefined
        ? defineLinear(
            d3.max(dataSimulation.slopesHistogram, (d) => d[rotate ? keyValues[0] : keyValues[1]]),
            0,
            d3.min(dataSimulation.slopesHistogram, (d) => d[rotate ? keyValues[0] : keyValues[1]])
          )
        : chart.y;

    const width = parseInt(d3.select(`#container-${CHART_ID}`).style('width'), 10);
    return defineChart(
      width,
      heightOfSpaceCurvesSlopesChart,
      defineX,
      defineY,
      ref,
      rotate,
      keyValues,
      CHART_ID
    );
  };

  const drawOPs = (chartLocal) => {
    const operationalPointsZone = chartLocal.drawZone
      .append('g')
      .attr('id', 'gev-operationalPointsZone');
    simulation.trains[selectedTrain].base.stops.forEach((stop) => {
      operationalPointsZone
        .append('line')
        .datum(stop.position)
        .attr('id', `op-${stop.id}`)
        .attr('class', 'op-line')
        .attr('x1', rotate ? 0 : (d) => chartLocal.x(d))
        .attr('y1', rotate ? (d) => chartLocal.y(d) : chartLocal.height)
        .attr('x2', rotate ? chartLocal.width : (d) => chartLocal.x(d))
        .attr('y2', rotate ? (d) => chartLocal.y(d) : 0);
      operationalPointsZone
        .append('text')
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
      chartLocal.drawZone.append('g').attr('id', 'curvesSlopesChart').attr('class', 'chartTrain');
      drawAxisTitle(chartLocal, rotate);
      if (dataSimulation.slopesHistogram) {
        drawCurve(
          chartLocal,
          'speed slopesHistogram',
          dataSimulation.slopesHistogram,
          'curvesSlopesChart',
          'curveMonotoneX',
          ['position', 'gradient'],
          'slopesHistogram',
          rotate
        );
        drawArea(
          chartLocal,
          'area slopes',
          dataSimulation.areaSlopesHistogram,
          'curvesSlopesChart',
          'curveMonotoneX',
          ['position', 'gradient'],
          rotate
        );
      }
      if (dataSimulation.curvesHistogram) {
        drawCurve(
          chartLocal,
          'speed curvesHistogram',
          dataSimulation.curvesHistogram,
          'curvesSlopesChart',
          'curveLinear',
          ['position', 'radius'],
          'curvesHistogram',
          rotate
        );
      }
      if (dataSimulation.slopesCurve) {
        drawCurve(
          chartLocal,
          'speed slopes',
          dataSimulation.slopesCurve,
          'curvesSlopesChart',
          'curveLinear',
          ['position', 'height'],
          'slopes',
          rotate
        );
      }

      // Operational points
      drawOPs(chartLocal);

      enableInteractivity(
        chartLocal,
        dataSimulation,
        dispatch,
        keyValues,
        LIST_VALUES_NAME_SPACE_CURVES_SLOPES,
        positionValues,
        rotate,
        setChart,
        setYPosition,
        setZoomLevel,
        yPosition,
        zoomLevel
      );
      setChart(chartLocal);
      dispatch(updateMustRedraw(false));
    }
  };

  useEffect(() => {
    drawTrain();
    handleWindowResize(CHART_ID, dispatch, drawTrain, isResizeActive, setResizeActive);
    return () => {
      window.removeEventListener('resize');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, mustRedraw, rotate]);

  useEffect(() => {
    traceVerticalLine(
      chart,
      dataSimulation,
      keyValues,
      LIST_VALUES_NAME_SPACE_CURVES_SLOPES,
      positionValues,
      'slopesCurve',
      rotate,
      timePosition
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, mustRedraw, positionValues, timePosition]);

  useEffect(() => {
    if (chartXGEV) {
      setChart({ ...chart, x: chartXGEV });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartXGEV]);

  return (
    <div
      id={`container-${CHART_ID}`}
      className="spacecurvesslopes-chart w-100"
      style={{ height: `${heightOfSpaceCurvesSlopesChart}px` }}
    >
      <div ref={ref} />
      <div className="handle-tab-resize">
        <CgLoadbar />
      </div>
    </div>
  );
}

SpaceCurvesSlopes.propTypes = {
  heightOfSpaceCurvesSlopesChart: PropTypes.number.isRequired,
};
