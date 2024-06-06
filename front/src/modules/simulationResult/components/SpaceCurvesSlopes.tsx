import React, { useEffect, useMemo, useRef, useState } from 'react';

import * as d3 from 'd3';
import { CgLoadbar } from 'react-icons/cg';
import { useSelector } from 'react-redux';

import {
  defineLinear,
  interpolateOnPosition,
  mergeDatasAreaConstant,
  type MergedBlock,
} from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import defineChart from 'modules/simulationResult/components/ChartHelpers/defineChart';
import drawArea from 'modules/simulationResult/components/ChartHelpers/drawArea';
import {
  traceVerticalLine,
  enableInteractivity,
} from 'modules/simulationResult/components/ChartHelpers/enableInteractivity';
import {
  createCurveCurve,
  createSlopeCurve,
} from 'modules/simulationResult/components/SpeedSpaceChart/utils';
import { CHART_AXES } from 'modules/simulationResult/consts';
import type { PositionScaleDomain } from 'modules/simulationResult/types';
import { getIsPlaying } from 'reducers/osrdsimulation/selectors';
import type {
  Chart,
  GradientPosition,
  HeightPosition,
  RadiusPosition,
  SpeedSpaceChart,
  PositionSpeedTime,
  Train,
} from 'reducers/osrdsimulation/types';
import { dateIsInRange } from 'utils/date';

import { useChartSynchronizer } from './ChartSynchronizer';
import { drawAxisTitle, drawSpaceCurvesSlopesChartCurve } from './SpaceCurvesSlopes/utils';

const CHART_ID = 'SpaceCurvesSlopes';

export type SpaceCurvesSlopesData = {
  gradients: number[];
  speed: PositionSpeedTime<number>[];
  slopesHistogram: GradientPosition[];
  areaSlopesHistogram: MergedBlock<'position' | 'gradient'>[];
  slopesCurve: HeightPosition[];
  curvesHistogram: RadiusPosition[];
};

type SpaceCurvesSlopesProps = {
  initialHeight: number;
  selectedTrain: Train;
  sharedXScaleDomain?: PositionScaleDomain;
  setSharedXScaleDomain?: React.Dispatch<React.SetStateAction<PositionScaleDomain>>;
};

const SpaceCurvesSlopes = ({
  initialHeight,
  selectedTrain,
  sharedXScaleDomain,
  setSharedXScaleDomain,
}: SpaceCurvesSlopesProps) => {
  const simulationIsPlaying = useSelector(getIsPlaying);

  const [chart, setChart] = useState<SpeedSpaceChart | undefined>(undefined);
  const [height, setHeight] = useState(initialHeight);
  const [initialYScaleDomain, setInitialYScaleDomain] = useState<number[]>([]);

  const ref = useRef<HTMLDivElement>(null);

  const trainData: SpaceCurvesSlopesData = useMemo(() => {
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
      gradients,
      speed,
      slopesHistogram,
      areaSlopesHistogram,
      slopesCurve,
      curvesHistogram,
    };
  }, [selectedTrain]);

  const timeScaleRange: [Date, Date] = useMemo(() => {
    if (chart) {
      const spaceScaleRange = chart.x.domain();
      return spaceScaleRange.map((position) => interpolateOnPosition(trainData, position)) as [
        Date,
        Date,
      ];
    }
    return [new Date(), new Date()];
  }, [chart]);

  const { updateTimePosition } = useChartSynchronizer(
    (timePosition, positionValues) => {
      if (dateIsInRange(timePosition, timeScaleRange)) {
        traceVerticalLine(chart, CHART_AXES.SPACE_GRADIENT, positionValues, timePosition);
      }
    },
    'space-curve',
    [chart, timeScaleRange]
  );

  const createChart = (): SpeedSpaceChart => {
    d3.select(`#${CHART_ID}`).remove();

    const xMax = d3.max(trainData.slopesHistogram, (d) => d.position + 100) || 0;
    const defineX = chart === undefined ? defineLinear(xMax) : chart.x;

    const yMin = d3.min(trainData.slopesHistogram, (d) => d.gradient);
    const yMax = d3.max(trainData.slopesHistogram, (d) => d.gradient) || 0;
    const defineY = chart === undefined ? defineLinear(yMax, 0, yMin) : chart.y;

    if (chart === undefined) {
      setInitialYScaleDomain(defineY.domain());
    }
    let y2Min: number | undefined;
    let y2Max: number | undefined;
    let defineY2: d3.ScaleLinear<number, number, never> = defineLinear(0, 0, 0);

    if (trainData.slopesCurve) {
      y2Min = d3.min(trainData.slopesCurve, (d) => d.height);
      y2Max = d3.max(trainData.slopesCurve, (d) => d.height) || 0;
      defineY2 = chart === undefined ? defineLinear(y2Max, 0, y2Min) : chart.y2;
    }

    const width = parseInt(d3.select(`#container-${CHART_ID}`).style('width'), 10);
    return defineChart(
      width,
      height,
      defineX,
      defineY,
      ref as React.MutableRefObject<HTMLDivElement>,
      false,
      ['position', 'gradient'],
      CHART_ID,
      defineY2
    ) as SpeedSpaceChart;
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
    drawAxisTitle(chartLocal, selectedTrain.slopes);
    drawSpaceCurvesSlopesChartCurve(
      chartLocal,
      'speed slopesHistogram',
      trainData.slopesHistogram,
      'curveMonotoneX',
      'gradient',
      'slopesHistogram'
    );
    // TODO : figure out a more precise name for future refacto
    drawArea(
      chartLocal,
      'area slopes',
      trainData.areaSlopesHistogram,
      'curvesSlopesChart',
      'curveMonotoneX'
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
      CHART_AXES.SPACE_GRADIENT,
      false,
      setChart,
      simulationIsPlaying,
      updateTimePosition,
      timeScaleRange,
      setSharedXScaleDomain,
      [CHART_AXES.SPACE_GRADIENT, CHART_AXES.SPACE_RADIUS, CHART_AXES.SPACE_HEIGHT]
    );

    setChart(chartLocal);
  };

  const windowResize = () => {
    const newHeight = (d3.select(`#container-${CHART_ID}`)?.node() as HTMLDivElement).clientHeight;
    setHeight(newHeight);
  };

  useEffect(() => {
    drawTrain();
  }, [trainData, height]);

  useEffect(() => {
    if (chart && sharedXScaleDomain && sharedXScaleDomain.source !== CHART_ID) {
      const newChart = { ...chart };
      newChart.x.domain(sharedXScaleDomain.current);
      if (sharedXScaleDomain.initial === sharedXScaleDomain.current) {
        newChart.y.domain(initialYScaleDomain);
      }
      setChart(newChart);
      drawTrain();
    }
  }, [sharedXScaleDomain]);

  useEffect(() => setHeight(initialHeight), [initialHeight]);

  useEffect(() => {
    window.addEventListener('resize', windowResize);
    return () => {
      window.removeEventListener('resize', windowResize);
    };
  }, []);

  return (
    <div
      id={`container-${CHART_ID}`}
      className="spacecurvesslopes-chart chart"
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
