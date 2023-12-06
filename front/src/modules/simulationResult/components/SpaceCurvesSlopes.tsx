import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as d3 from 'd3';
import { CgLoadbar } from 'react-icons/cg';

import { CHART_AXES } from 'modules/simulationResult/components/simulationResultsConsts';
import type { PositionScaleDomain } from 'modules/simulationResult/components/simulationResultsConsts';
import {
  defineLinear,
  interpolateOnPosition,
  mergeDatasAreaConstant,
  MergedBlock,
} from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import {
  traceVerticalLine,
  enableInteractivity,
} from 'modules/simulationResult/components/ChartHelpers/enableInteractivity';
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
  RadiusPosition,
  SpeedSpaceChart,
  PositionSpeedTime,
  Train,
  PositionsSpeedTimes,
} from 'reducers/osrdsimulation/types';
import { dateIsInRange } from 'utils/date';
import { updateTimePositionValues } from 'reducers/osrdsimulation/actions';
import { getIsPlaying } from 'reducers/osrdsimulation/selectors';

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

const drawSpaceCurvesSlopesChartCurve = <
  T extends GradientPosition | RadiusPosition | HeightPosition
>(
  chartLocal: SpeedSpaceChart,
  classes: string,
  data: T[],
  interpolation: 'curveLinear' | 'curveMonotoneX',
  yAxisValue: 'gradient' | 'radius' | 'height',
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
  positionValues: PositionsSpeedTimes<Date>;
  selectedTrain: Train;
  timePosition: Date;
  sharedXScaleDomain?: PositionScaleDomain;
  setSharedXScaleDomain?: React.Dispatch<React.SetStateAction<PositionScaleDomain>>;
};

const SpaceCurvesSlopes = ({
  initialHeight,
  positionValues,
  selectedTrain,
  timePosition,
  sharedXScaleDomain,
  setSharedXScaleDomain,
}: SpaceCurvesSlopesProps) => {
  const dispatch = useDispatch();
  const simulationIsPlaying = useSelector(getIsPlaying);

  const [chart, setChart] = useState<SpeedSpaceChart | undefined>(undefined);
  const [height, setHeight] = useState(initialHeight);
  const [initialYScaleDomain, setInitialYScaleDomain] = useState<number[]>([]);

  const ref = useRef<HTMLDivElement>(null);
  const rotate = false;

  const dispatchUpdateTimePositionValues = (newTimePositionValue: Date) => {
    dispatch(updateTimePositionValues(newTimePositionValue));
  };

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
        Date
      ];
    }
    return [new Date(), new Date()];
  }, [chart]);

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
      CHART_AXES.SPACE_GRADIENT,
      rotate,
      setChart,
      simulationIsPlaying,
      dispatchUpdateTimePositionValues,
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
    if (dateIsInRange(timePosition, timeScaleRange)) {
      traceVerticalLine(chart, CHART_AXES.SPACE_GRADIENT, positionValues, rotate, timePosition);
    }
  }, [positionValues, timePosition]);

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
