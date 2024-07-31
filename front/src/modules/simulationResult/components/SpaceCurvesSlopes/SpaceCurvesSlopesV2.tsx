import React, { useEffect, useMemo, useRef, useState } from 'react';

import * as d3 from 'd3';
import { CgLoadbar } from 'react-icons/cg';
import { useSelector } from 'react-redux';

import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import {
  defineLinear,
  interpolateOnPositionV2,
  mergeDatasAreaConstantV2,
} from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import defineChart from 'modules/simulationResult/components/ChartHelpers/defineChart';
import drawArea from 'modules/simulationResult/components/ChartHelpers/drawArea';
import {
  traceVerticalLine,
  enableInteractivityV2,
} from 'modules/simulationResult/components/ChartHelpers/enableInteractivity';
import type { ReportTrainData } from 'modules/simulationResult/components/SpeedSpaceChart/types';
import { CHART_AXES } from 'modules/simulationResult/consts';
import type { PositionScaleDomain, SpaceCurvesSlopesDataV2 } from 'modules/simulationResult/types';
import { getIsPlaying } from 'reducers/osrdsimulation/selectors';
import type { Chart, SpeedSpaceChart } from 'reducers/osrdsimulation/types';
import { dateIsInRange, isoDateWithTimezoneToSec } from 'utils/date';
import { mmToM } from 'utils/physics';

import {
  createCurveCurve,
  createSlopeCurve,
  drawAxisTitle,
  drawSpaceCurvesSlopesChartCurve,
} from './utils';
import { useChartSynchronizerV2 } from '../ChartSynchronizer';

const CHART_ID = 'SpaceCurvesSlopes';

type SpaceCurvesSlopesV2Props = {
  initialHeight: number;
  trainSimulation: SimulationResponseSuccess;
  pathProperties: PathPropertiesFormatted;
  sharedXScaleDomain?: PositionScaleDomain;
  setSharedXScaleDomain?: React.Dispatch<React.SetStateAction<PositionScaleDomain>>;
  departureTime: string;
};

const SpaceCurvesSlopesV2 = ({
  initialHeight,
  trainSimulation,
  pathProperties,
  sharedXScaleDomain,
  setSharedXScaleDomain,
  departureTime,
}: SpaceCurvesSlopesV2Props) => {
  const simulationIsPlaying = useSelector(getIsPlaying);
  const { base } = trainSimulation;
  const { operationalPoints, slopes, curves } = pathProperties;

  const [chart, setChart] = useState<SpeedSpaceChart | undefined>(undefined);
  const [height, setHeight] = useState(initialHeight);
  const [initialYScaleDomain, setInitialYScaleDomain] = useState<number[]>([]);

  const ref = useRef<HTMLDivElement>(null);

  const trainData: SpaceCurvesSlopesDataV2 = useMemo(() => {
    // speeds (needed for enableInteractivity)

    const baseSpeedData: ReportTrainData[] = base.speeds.map((speed, i) => ({
      speed: speed * 3.6,
      position: base.positions[i] / 1000,
      time: base.times[i],
    }));

    // slopes
    const gradients = slopes.map((step) => step.gradient);
    const areaSlopesHistogram = mergeDatasAreaConstantV2(slopes, 0, ['position', 'gradient']);
    const slopesCurve = createSlopeCurve(slopes, gradients);

    // curves
    const curvesHistogram = createCurveCurve(curves, gradients);

    return {
      gradients,
      speed: baseSpeedData,
      slopesHistogram: slopes,
      areaSlopesHistogram,
      slopesCurve,
      curvesHistogram,
    };
  }, [pathProperties]);

  const timeScaleRange: [Date, Date] = useMemo(() => {
    if (chart) {
      const spaceScaleRange = chart.x.domain();
      return spaceScaleRange.map((position) =>
        interpolateOnPositionV2(trainData, position, isoDateWithTimezoneToSec(departureTime))
      ) as [Date, Date];
    }
    return [new Date(), new Date()];
  }, [chart]);

  const { updateTimePosition } = useChartSynchronizerV2(
    (timePosition, positionValues) => {
      if (dateIsInRange(timePosition, timeScaleRange)) {
        traceVerticalLine(chart, CHART_AXES.SPACE_GRADIENT, positionValues);
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
      CHART_ID,
      defineY2
    ) as SpeedSpaceChart;
  };

  const drawOPs = (chartLocal: Chart) => {
    const operationalPointsZone = chartLocal.drawZone
      .append('g')
      .attr('id', 'gev-operationalPointsZone');
    operationalPoints!.forEach((op) => {
      operationalPointsZone
        .append('line')
        .datum(mmToM(op.position))
        .attr('id', `op-${op.id}`)
        .attr('class', 'op-line')
        .attr('x1', (d) => chartLocal.x(d))
        .attr('y1', chartLocal.height)
        .attr('x2', (d) => chartLocal.x(d))
        .attr('y2', 0);
      operationalPointsZone
        .append('text')
        .datum(mmToM(op.position))
        .attr('class', 'op-text')
        .text(`${op.extensions?.identifier?.name}`)
        .attr('x', (d) => chartLocal.x(d))
        .attr('y', chartLocal.height)
        .attr('text-anchor', 'center')
        .attr('transform', `rotate(0 ${chartLocal.x(mmToM(op.position))}, ${chartLocal.height})`)
        .attr('dx', 5)
        .attr('dy', 15 - chartLocal.height);
    });
  };

  const drawTrain = () => {
    const chartLocal = createChart();
    chartLocal.drawZone.append('g').attr('id', 'curvesSlopesChart').attr('class', 'chartTrain');
    drawAxisTitle(chartLocal, trainData.slopesHistogram);
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

    enableInteractivityV2(
      chartLocal,
      trainData,
      CHART_AXES.SPACE_GRADIENT,
      false,
      setChart,
      simulationIsPlaying,
      updateTimePosition,
      timeScaleRange,
      departureTime,
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

export default SpaceCurvesSlopesV2;
