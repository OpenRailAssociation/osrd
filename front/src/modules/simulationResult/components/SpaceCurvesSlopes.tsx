import * as d3 from 'd3';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  defineLinear,
  mergeDatasAreaConstant,
} from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import enableInteractivity, {
  traceVerticalLine,
} from 'modules/simulationResult/components/ChartHelpers/enableInteractivity';
import { useDispatch } from 'react-redux';
import { CgLoadbar } from 'react-icons/cg';
import {
  createCurveCurve,
  createSlopeCurve,
} from 'modules/simulationResult/components/SpeedSpaceChart/utils';
import defineChart from 'modules/simulationResult/components/ChartHelpers/defineChart';
import drawArea from 'modules/simulationResult/components/ChartHelpers/drawArea';
import drawCurve from 'modules/simulationResult/components/ChartHelpers/drawCurve';
import {
  Chart,
  GradientPosition,
  HeightPosition,
  PositionValues,
  RadiusPosition,
  Train,
} from 'reducers/osrdsimulation/types';

const CHART_ID = 'SpaceCurvesSlopes';

const drawAxisTitle = (chart: Chart) => {
  chart.drawZone
    .append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('transform', 'rotate(-90)')
    .attr('x', -10)
    .attr('y', 20)
    .text('m/km');

  chart.drawZone
    .append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('transform', 'rotate(0)')
    .attr('x', chart.width - 10)
    .attr('y', chart.height - 10)
    .text('m');
};

const drawSpaceCurvesSlopesChartCurve = (
  chartLocal: Chart,
  classes: string,
  data: GradientPosition[] | RadiusPosition[] | HeightPosition[],
  interpolation: 'curveLinear' | 'curveMonotoneX',
  yAxisValue: string,
  curveName: string
) => {
  drawCurve(
    chartLocal,
    classes,
    data,
    'curvesSlopesChart',
    interpolation,
    ['position', yAxisValue],
    curveName,
    false
  );
};

type SpaceCurvesSlopesProps = {
  initialHeight: number;
  positionValues: PositionValues;
  selectedTrain: Train;
  timePosition: Date;
};

const SpaceCurvesSlopes = ({
  initialHeight,
  positionValues,
  selectedTrain,
  timePosition,
}: SpaceCurvesSlopesProps) => {
  const dispatch = useDispatch();

  const [chart, setChart] = useState<Chart | undefined>(undefined);
  const [height, setHeight] = useState(initialHeight);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [yPosition, setYPosition] = useState(0);

  const ref = useRef<HTMLDivElement>(null);
  const keyValues = ['position', 'gradient'];
  const rotate = false;

  const trainData = useMemo(() => {
    // speeds (needed for enableInteractivity)
    const speed = selectedTrain.base.speeds.map((step) => ({
      ...step,
      speed: step.speed * 3.6,
    }));
    // slopes
    const slopesHistogram = selectedTrain.slopes.map((step) => ({
      position: step.position,
      gradient: step.gradient,
    }));
    const gradients = selectedTrain.slopes.map((step) => step.gradient);
    const areaSlopesHistogram = mergeDatasAreaConstant(slopesHistogram, 0, [
      'position',
      'gradient',
    ]);
    const slopesCurve = createSlopeCurve(selectedTrain.slopes, gradients);
    // curves
    const curvesHistogram = createCurveCurve(selectedTrain.curves, gradients);

    return {
      speed,
      slopesHistogram,
      areaSlopesHistogram,
      slopesCurve,
      curvesHistogram,
    };
  }, [selectedTrain]);

  const createChart = (): Chart => {
    d3.select(`#${CHART_ID}`).remove();

    const xMax = d3.max(trainData.slopesHistogram, (d) => d.position + 100) || 0;
    const defineX = chart === undefined ? defineLinear(xMax) : chart.x;

    const yMin = d3.min(trainData.slopesHistogram, (d) => d.gradient);
    const yMax = d3.max(trainData.slopesHistogram, (d) => d.gradient) || 0;
    const defineY = chart === undefined ? defineLinear(yMax, 0, yMin) : chart.y;

    const width = parseInt(d3.select(`#container-${CHART_ID}`).style('width'), 10);
    return defineChart(
      width,
      height,
      defineX,
      defineY,
      ref as React.MutableRefObject<HTMLDivElement>,
      false,
      ['position', 'gradient'],
      CHART_ID
    );
  };

  const drawOPs = (chartLocal: Chart) => {
    const operationalPointsZone = chartLocal.drawZone
      .append('g')
      .attr('id', 'gev-operationalPointsZone');
    selectedTrain.base.stops.forEach((stop) => {
      operationalPointsZone
        .append('line')
        .datum(stop.position)
        .attr('id', `op-${stop.id}`)
        .attr('class', 'op-line')
        .attr('x1', (d) => chartLocal.x(d))
        .attr('y1', chartLocal.height)
        .attr('x2', (d) => chartLocal.x(d))
        .attr('y2', 0);
      operationalPointsZone
        .append('text')
        .datum(stop.position)
        .attr('class', 'op-text')
        .text(`${stop.name}`)
        .attr('x', (d) => chartLocal.x(d))
        .attr('y', chartLocal.height)
        .attr('text-anchor', 'center')
        .attr('transform', `rotate(0 ${chartLocal.x(stop.position)}, ${chartLocal.height})`)
        .attr('dx', 5)
        .attr('dy', 15 - chartLocal.height);
    });
  };

  const drawTrain = () => {
    const chartLocal = createChart();
    chartLocal.drawZone.append('g').attr('id', 'curvesSlopesChart').attr('class', 'chartTrain');
    drawAxisTitle(chartLocal);
    drawSpaceCurvesSlopesChartCurve(
      chartLocal,
      'speed slopesHistogram',
      trainData.slopesHistogram,
      'curveMonotoneX',
      'gradient',
      'slopesHistogram'
    );
    drawArea(
      chartLocal,
      'area slopes',
      trainData.areaSlopesHistogram,
      'curvesSlopesChart',
      'curveMonotoneX',
      rotate
    );
    drawSpaceCurvesSlopesChartCurve(
      chartLocal,
      'speed curvesHistogram',
      trainData.curvesHistogram,
      'curveLinear',
      'radius',
      'curvesHistogram'
    );
    drawSpaceCurvesSlopesChartCurve(
      chartLocal,
      'speed slopes',
      trainData.slopesCurve,
      'curveLinear',
      'height',
      'slopes'
    );

    // Operational points
    drawOPs(chartLocal);

    enableInteractivity(
      chartLocal,
      trainData,
      dispatch,
      ['position', 'gradient'],
      ['slopesCurve'],
      positionValues,
      rotate,
      setChart,
      setYPosition,
      setZoomLevel,
      yPosition,
      zoomLevel
    );
    setChart(chartLocal);
  };

  const windowResize = () => {
    const newHeight = (d3.select(`#container-${CHART_ID}`)?.node() as HTMLDivElement).clientHeight;
    setHeight(newHeight);
  };

  useEffect(() => drawTrain(), [trainData, height]);

  useEffect(() => setHeight(initialHeight), [initialHeight]);

  useEffect(() => {
    if (trainData) {
      traceVerticalLine(
        chart,
        trainData,
        keyValues,
        ['slopesCurve'],
        positionValues,
        'slopesCurve',
        rotate,
        timePosition
      );
    }
  }, [positionValues, timePosition, trainData]);

  useEffect(() => {
    window.addEventListener('resize', windowResize);
    return () => {
      window.removeEventListener('resize', windowResize);
    };
  }, []);

  return (
    <div
      id={`container-${CHART_ID}`}
      className="spacecurvesslopes-chart w-100"
      style={{ height: `${height}px` }}
    >
      <div ref={ref} />
      <div className="handle-tab-resize">
        <CgLoadbar />
      </div>
    </div>
  );
};

export default SpaceCurvesSlopes;
