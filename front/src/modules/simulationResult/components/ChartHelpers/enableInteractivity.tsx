import * as d3 from 'd3';
import { mapValues } from 'lodash';
import { zoom as d3zoom } from 'd3-zoom';
import { pointer } from 'd3-selection';

import {
  gridX,
  gridY,
  interpolateOnPosition,
  interpolateOnTime,
  getAxis,
  isSpaceTimeChart,
} from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import {
  CHART_AXES,
  LIST_VALUES,
} from 'modules/simulationResult/components/simulationResultsConsts';
import type {
  ChartAxes,
  PositionScaleDomain,
} from 'modules/simulationResult/components/simulationResultsConsts';
import drawGuideLines from 'modules/simulationResult/components/ChartHelpers/drawGuideLines';
import { dateIsInRange } from 'utils/date';
import type {
  Chart,
  ConsolidatedRouteAspect,
  GradientPosition,
  Position,
  SimulationD3Scale,
  SpeedPosition,
  ConsolidatedSpeedTime,
  ConsolidatedPositionSpeedTime,
  SpeedSpaceChart,
  SimulationTrain,
  PositionSpeedTime,
  PositionsSpeedTimes,
} from 'reducers/osrdsimulation/types';
import type { typedEntries } from 'utils/types';
import type { SpaceCurvesSlopesData } from 'modules/simulationResult/components/SpaceCurvesSlopes';
import type { AreaBlock, GevPreparedData } from '../SpeedSpaceChart/prepareData';

export const displayGuide = (chart: Chart, opacity: number) => {
  if (chart?.svg) {
    chart.svg.selectAll('#vertical-line').style('opacity', opacity);
    chart.svg.selectAll('#horizontal-line').style('opacity', opacity);
    chart.svg.selectAll('.pointer').style('opacity', opacity);
  } else {
    console.warn('attempt to display guide with no whart.svg set, check order of impl.');
  }
};

export const updatePointers = (
  chart: Chart,
  keyValues: ChartAxes,
  positionValues: PositionsSpeedTimes<Date>,
  rotate: boolean
) => {
  const xAxis = getAxis(keyValues, 'x', rotate);
  const yAxis = getAxis(keyValues, 'y', rotate);
  (Object.entries(positionValues) as typedEntries<PositionsSpeedTimes<Date>>)
    .map<[keyof PositionsSpeedTimes<Date>, ConsolidatedPositionSpeedTime | ConsolidatedSpeedTime]>(
      ([name, positionValue]) => {
        const consolidatedPositionValue = mapValues(positionValue, (value, key) => {
          if (key === 'time') {
            return new Date(value);
          }
          return value;
        }) as ConsolidatedPositionSpeedTime | ConsolidatedSpeedTime;
        return [name, consolidatedPositionValue];
      }
    )
    .forEach(([name, positionValue]) => {
      type Key = keyof typeof positionValue;
      if (chart?.svg) {
        chart?.svg
          .selectAll(`#pointer-${name}`)
          .attr('cx', chart.x(positionValue[xAxis as Key]))
          .attr('cy', chart.y(positionValue[yAxis as Key]));
      }
    });
};

const updateChart = <
  T extends SpeedPosition | GradientPosition | Position,
  Datum extends ConsolidatedRouteAspect
>(
  chart: Chart,
  keyValues: ChartAxes,
  additionalValues: ChartAxes[], // more values to display on the same chart
  rotate: boolean,
  event: d3.D3ZoomEvent<Element, Datum>
) => {
  // recover the new scale & test if movement under 0
  const xAxis = getAxis(keyValues, 'x', rotate);
  const supplementaryXAxis = additionalValues.map((value) => getAxis(value, 'x', rotate));
  const yAxis = getAxis(keyValues, 'y', rotate);
  const supplementaryYAxis = additionalValues.map((value) => getAxis(value, 'y', rotate));
  const xAxisStart = `${xAxis}_start` as const;
  const xAxisEnd = `${xAxis}_end` as const;
  const yAxisStart = `${yAxis}_start` as 'time_start' | 'position_start';
  const yAxisEnd = `${yAxis}_end` as 'time_end' | 'position_end';

  let newX = chart.x;
  let newY = chart.y;
  if (event.sourceEvent.shiftKey || event.sourceEvent.ctrlKey) {
    newX = event.transform.rescaleX(chart.originalScaleX as SimulationD3Scale);
    newY = event.transform.rescaleY(chart.originalScaleY as SimulationD3Scale);
  }

  // update axes with these new boundaries
  const axisBottomX =
    !rotate && isSpaceTimeChart(keyValues)
      ? d3
          .axisBottom<Date>(newX as d3.ScaleTime<number, number>)
          .tickFormat(d3.timeFormat('%H:%M:%S'))
      : d3.axisBottom(newX);
  const axisLeftY =
    rotate && isSpaceTimeChart(keyValues)
      ? d3
          .axisLeft<Date>(newY as d3.ScaleTime<number, number>)
          .tickFormat(d3.timeFormat('%H:%M:%S'))
      : d3.axisLeft(newY);
  chart.xAxis.call(axisBottomX);
  chart.yAxis.call(axisLeftY);

  chart.xAxisGrid.call(gridX(newX, chart.height));
  chart.yAxisGrid.call(gridY(newY, chart.width));

  // update lines & areas

  chart.drawZone.selectAll<SVGLineElement, T[]>('.line').attr(
    'd',
    d3
      .line<T>()
      .x((d) => {
        const key = supplementaryXAxis.find((axis) => d[axis as keyof T] !== undefined) || xAxis;
        return newX(d[key as keyof T] as number | Date);
      })
      .y((d) => {
        const key = supplementaryYAxis.find((axis) => d[axis as keyof T] !== undefined) || yAxis;
        return newY(d[key as keyof T] as number | Date);
      })
  );

  chart.drawZone
    .selectAll<SVGRectElement, ConsolidatedRouteAspect>('rect.route-aspect')
    .attr('x', (d) => newX(d[xAxisStart]!))
    .attr('y', (d) => newY(d[yAxisStart]!) - (newY(d[yAxisEnd]!) - newY(d[yAxisStart]!)) * -1)
    .attr('width', (d) => newX(d[xAxisEnd]!) - newX(d[xAxisStart]!))
    .attr('height', (d) => (newY(d[yAxisEnd]!) - newY(d[yAxisStart]!)) * -1);

  const newAreaData = rotate
    ? d3
        .area<AreaBlock>()
        .y((d) => newY(d.position))
        .x0((d) => newX(d.value0))
        .x1((d) => newX(d.value1))
        .curve(isSpaceTimeChart(keyValues) ? d3.curveStepAfter : d3.curveLinear)
    : d3
        .area<AreaBlock>()
        .x((d) => newX(d.position))
        .y0((d) => newY(d.value0))
        .y1((d) => newY(d.value1))
        .curve(isSpaceTimeChart(keyValues) ? d3.curveStepAfter : d3.curveLinear);

  chart.drawZone.selectAll<SVGPathElement, AreaBlock[]>('.area').attr('d', newAreaData);

  // OPERATIONNAL POINTS
  if (rotate) {
    chart.drawZone
      .selectAll('#get-operationalPointsZone .op-line')
      .attr('x1', (d) => newX(d as number))
      .attr('x2', (d) => newX(d as number));
    chart.drawZone
      .selectAll('#get-operationalPointsZone .op-text')
      .attr('x', (d) => newX(d as number));
    chart.drawZone
      .selectAll('#gev-operationalPointsZone .op-line')
      .attr('y1', (d) => newY(d as number))
      .attr('y2', (d) => newY(d as number));
    chart.drawZone
      .selectAll('#gev-operationalPointsZone .op-text')
      .attr('y', (d) => newY(d as number));
  } else {
    chart.drawZone
      .selectAll('#get-operationalPointsZone .op-line')
      .attr('y1', (d) => newY(d as number))
      .attr('y2', (d) => newY(d as number));
    chart.drawZone
      .selectAll('#get-operationalPointsZone .op-text')
      .attr('y', (d) => newY(d as number));
    chart.drawZone
      .selectAll('#gev-operationalPointsZone .op-line')
      .attr('x1', (d) => newX(d as number))
      .attr('x2', (d) => newX(d as number));
    chart.drawZone
      .selectAll('#gev-operationalPointsZone .op-text')
      .attr('x', (d) => newX(d as number));
  }

  chart.drawZone
    .selectAll<SVGTextElement, { x: Date; y: number; direction: boolean }>('.curve-label')
    .attr('x', (d) => newX(d.x))
    .attr('y', (d) =>
      d.direction ? newY(d.y) + event.transform.k * 15 : newY(d.y) - event.transform.k * 5
    );

  return { newX, newY };
};

// Factorizes func to update VerticalLine on 3 charts: SpaceTime, SpeedSpaceChart, SpaceCurvesSlopes
export const traceVerticalLine = (
  chart: Chart | undefined,
  keyValues: ChartAxes,
  positionValues: PositionsSpeedTimes<Date>,
  rotate: boolean,
  timePosition: Date
) => {
  if (chart !== undefined) {
    const linePosition =
      !isSpaceTimeChart(keyValues) && positionValues.speed
        ? positionValues.speed.position
        : timePosition;
    displayGuide(chart, 1);
    if (rotate) {
      chart.svg
        .selectAll('#horizontal-line')
        .attr('y1', chart.y(linePosition))
        .attr('y2', chart.y(linePosition));
    } else {
      chart.svg
        .selectAll('#vertical-line')
        .attr('x1', chart.x(linePosition))
        .attr('x2', chart.x(linePosition));
    }

    updatePointers(chart, keyValues, positionValues, rotate);
  }
};

// enableInteractivity

// Override the default wheelDelta computation to get smoother zoom
function wheelDelta(event: WheelEvent) {
  let factor = 1;
  if (event.deltaMode === 1) {
    factor = 0.005;
  } else if (event.deltaMode) {
    factor = 0.01;
  } else {
    factor = 0.002;
  }

  return -event.deltaY * factor;
}

export const enableInteractivity = <
  T extends Chart | SpeedSpaceChart,
  Data extends SimulationTrain<Date> | GevPreparedData | SpaceCurvesSlopesData
>(
  chart: T | undefined,
  selectedTrainData: Data,
  keyValues: ChartAxes,
  rotate: boolean,
  setChart: React.Dispatch<React.SetStateAction<T | undefined>>,
  simulationIsPlaying: boolean,
  dispatchUpdateTimePositionValues: (newTimePositionValues: Date) => void,
  chartDimensions: [Date, Date],
  setSharedXScaleDomain?: React.Dispatch<React.SetStateAction<PositionScaleDomain>>,
  additionalValues: ChartAxes[] = [] // more values to display on the same chart
) => {
  if (!chart) return;
  const zoom = d3zoom<SVGGElement, unknown>()
    .scaleExtent([0.3, 20]) // This controls how much you can unzoom (x0.5) and zoom (x20)
    .extent([
      [0, 0],
      [chart.width, chart.height],
    ])
    .wheelDelta(wheelDelta)
    .on('zoom', (event) => {
      event.sourceEvent.preventDefault();
      const zoomFunctions = updateChart(chart, keyValues, additionalValues, rotate, event);
      const newChart = { ...chart, x: zoomFunctions.newX, y: zoomFunctions.newY };
      if (setSharedXScaleDomain)
        setSharedXScaleDomain((prevState) => ({
          ...prevState,
          current: newChart.x.domain() as number[],
          source: keyValues === CHART_AXES.SPACE_SPEED ? 'SpeedSpaceChart' : 'SpaceCurvesSlopes',
        }));
      setChart(newChart);
    })
    .filter(
      (event) => (event.button === 0 || event.button === 1) && (event.ctrlKey || event.shiftKey)
    );

  // TODO: actually a number as we’re not in node.js
  let debounceTimeoutId: NodeJS.Timeout;
  function debounceUpdateTimePositionValues(timePositionLocal: Date, interval: number) {
    clearTimeout(debounceTimeoutId);
    debounceTimeoutId = setTimeout(() => {
      dispatchUpdateTimePositionValues(timePositionLocal);
    }, interval);
  }

  const mousemove = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!simulationIsPlaying) {
      let immediatePositionsValuesForPointer: ReturnType<typeof interpolateOnTime>;
      let timePositionLocal: Date | null;
      if (isSpaceTimeChart(keyValues)) {
        // SpaceTimeChart
        timePositionLocal = (
          rotate
            ? chart.y.invert(pointer(event, event.currentTarget)[1])
            : chart.x.invert(pointer(event, event.currentTarget)[0])
        ) as Date;

        immediatePositionsValuesForPointer = interpolateOnTime(
          selectedTrainData,
          keyValues,
          LIST_VALUES.SPACE_TIME,
          timePositionLocal
        );
      } else {
        // SpeedSpaceChart or SpaceCurvesSlopesChart
        const positionLocal = (
          rotate
            ? chart.y.invert(pointer(event, event.currentTarget)[1])
            : chart.x.invert(pointer(event, event.currentTarget)[0])
        ) as number;
        timePositionLocal = interpolateOnPosition(
          selectedTrainData as { speed: PositionSpeedTime[] },
          positionLocal
        );

        if (!timePositionLocal) {
          console.error('Interpolation failed');
          return;
        }

        immediatePositionsValuesForPointer = interpolateOnTime(
          selectedTrainData,
          keyValues,
          LIST_VALUES.SPACE_SPEED,
          timePositionLocal
        );

        // GEV prepareData func multiply speeds by 3.6. We need to normalize that to make a convenitn pointer update
        LIST_VALUES.SPACE_SPEED.forEach((name) => {
          if (
            immediatePositionsValuesForPointer[name] &&
            !Number.isNaN(immediatePositionsValuesForPointer[name].speed)
          ) {
            immediatePositionsValuesForPointer[name].speed /= 3.6;
          }
        });
      }

      debounceUpdateTimePositionValues(timePositionLocal, 15);
      if (chart.svg && dateIsInRange(timePositionLocal, chartDimensions)) {
        const verticalMark = pointer(event, event.currentTarget)[0];
        const horizontalMark = pointer(event, event.currentTarget)[1];
        chart.svg.selectAll('#vertical-line').attr('x1', verticalMark).attr('x2', verticalMark);
        chart.svg
          .selectAll('#horizontal-line')
          .attr('y1', horizontalMark)
          .attr('y2', horizontalMark);
      }
    }
  };

  chart.svg
    .on('mouseover', () => displayGuide(chart, 1))
    .on('mousemove', mousemove)
    .on('wheel', (event) => {
      if (event.ctrlKey || event.shiftKey) {
        event.preventDefault();
      }
    })
    .call(zoom);

  drawGuideLines(chart);
};
