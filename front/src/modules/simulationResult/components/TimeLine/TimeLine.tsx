import * as d3 from 'd3';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';

import { sec2datetime } from 'utils/timeManipulation';
import { updateChart } from 'reducers/osrdsimulation/actions';
import { SimulationReport } from 'common/api/osrdEditoastApi';
import { Chart, SimulationD3Scale } from 'reducers/osrdsimulation/types';
import { getDirection, gridX } from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import { useChartSynchronizer } from '../ChartHelpers/ChartSynchronizer';

const drawTrain = (
  train: SimulationReport,
  selectedTrainId: number,
  xScale: d3.ScaleTime<number, number, never>,
  svg: d3.Selection<SVGGElement, unknown, null, undefined>,
  height: number
) => {
  const startTime = train.base.stops[0].time;
  const endTime = train.base.stops[train.base.stops.length - 1].time;
  const direction = getDirection(train.base.head_positions);

  const y1 = direction ? height - 4 : 4;
  const y2 = direction ? 4 : height - 4;

  svg
    .append('line')
    .attr('class', selectedTrainId === train.id ? 'timeline-train selected' : 'timeline-train')
    .attr('x1', xScale(sec2datetime(startTime)))
    .attr('y1', y1)
    .attr('x2', xScale(sec2datetime(endTime)))
    .attr('y2', y2);
};

type TimeLineProps = {
  chart: Chart;
  selectedTrainId: number;
  trains: SimulationReport[];
};

const TimeLine = ({ chart, selectedTrainId, trains }: TimeLineProps) => {
  const dispatch = useDispatch();

  const ref = useRef<HTMLDivElement>(null);
  const [svgState, setSvg] = useState<
    d3.Selection<SVGGElement, unknown, null, undefined> | undefined
  >(undefined);

  const dataRange = useMemo(() => {
    const min =
      d3.min(trains, (train) =>
        d3.min(train.base.head_positions, (section) => d3.min(section, (step) => step.time))
      ) || 0;
    const max =
      d3.max(trains, (train) =>
        d3.max(train.base.head_positions, (section) => d3.max(section, (step) => step.time))
      ) || 0;
    return [sec2datetime(min), sec2datetime(max)];
  }, [trains]);

  const dimensions = useMemo(
    () => ({
      width: ref.current ? ref.current.offsetWidth : 800,
      height: 40,
      margin: {
        top: 0,
        right: 1,
        bottom: 20,
        left: 10,
      },
    }),
    [ref]
  );

  const [localTimePosition, setLocalTimePosition] = useState(new Date());
  useChartSynchronizer(
    (timePosition) => {
      setLocalTimePosition(timePosition);
    },
    'timeline',
    []
  );

  const moveTimePosition = (svg: d3.Selection<SVGGElement, unknown, null, undefined>) => {
    const xScale = d3
      .scaleTime()
      .domain(dataRange)
      .range([dimensions.margin.left, dimensions.width - dimensions.margin.right]);

    svg
      .select('#timePositionTimeLine')
      .attr('transform', `translate(${xScale(localTimePosition)},0)`);
  };

  const drawChart = () => {
    if (d3.select(ref.current)) {
      d3.select(ref.current).select('svg').remove();
    }
    const chartRect = (chart.rotate ? chart.y.domain() : chart.x.domain()) as Date[];

    const svg = d3
      .select(ref.current)
      .append('svg')
      .attr(
        'viewBox',
        `0 0 ${dimensions.width + dimensions.margin.left + dimensions.margin.right} ${
          dimensions.height + dimensions.margin.top + dimensions.margin.bottom
        }`
      )
      .append('g')
      .attr('transform', `translate(${dimensions.margin.left},${dimensions.margin.top})`);

    svg
      .append('defs')
      .append('SVG:clipPath')
      .attr('id', 'timelineClipPath')
      .append('SVG:rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', dimensions.width)
      .attr('height', dimensions.height);

    const xScale = d3
      .scaleTime()
      .domain(dataRange)
      .range([dimensions.margin.left, dimensions.width - dimensions.margin.right])
      .nice();
    const axisBottomX = d3
      .axisBottom(xScale)
      .tickFormat((date) => d3.timeFormat('%H:%M')(date as Date));
    svg.append('g').attr('transform', `translate(0, ${dimensions.height})`).call(axisBottomX);

    svg
      .append('g')
      .attr('transform', `translate(0,${dimensions.height})`)
      .attr('class', 'grid')
      .call(gridX(xScale, dimensions.height));
    svg.append('g').attr('clip-path', 'url(#timelineClipPath)');

    // timePosition cursor
    svg
      .append('g')
      .attr('class', 'timeline-cursor')
      .attr('id', 'timePositionTimeLine')
      .append('line')
      .attr('x1', 0)
      .attr('y1', dimensions.height)
      .attr('x2', 0)
      .attr('y2', 0);
    svg
      .select('#timePositionTimeLine')
      .append('path')
      .attr('d', d3.symbol().type(d3.symbolTriangle).size(40))
      .attr('transform', `translate(0,${dimensions.height + 8})`);

    svg
      .select('#timePositionTimeLine')
      .attr('transform', `translate(${xScale(localTimePosition)},0)`);

    // draw trains
    trains.map((train) => drawTrain(train, selectedTrainId, xScale, svg, dimensions.height));

    // drag behaviour
    let dragValue = 0;
    const drag = d3
      .drag<SVGRectElement, unknown>()
      .on('end', () => {
        const delta = xScale.invert(dragValue).getTime() - xScale.domain()[0].getTime();
        const newX0 = new Date(chartRect[0].getTime() + delta);
        const newX1 = new Date(chartRect[1].getTime() + delta);
        dispatch(updateChart({ ...chart, x: chart.x.domain([newX0, newX1]) as SimulationD3Scale }));
      })
      .on('drag', (event) => {
        dragValue += event.dx;
        d3.select('#rectZoomTimeLine').attr('transform', `translate(${dragValue},0)`);
      });

    svg
      .append('rect')
      .attr('id', 'rectZoomTimeLine')
      .attr('x', xScale(chartRect[0]))
      .attr('y', 1)
      .attr('width', xScale(chartRect[1]) - xScale(chartRect[0]))
      .attr('height', dimensions.height - 1)
      .call(drag);

    setSvg(svg);
  };

  useEffect(() => {
    drawChart();
  }, [trains]);

  useEffect(() => {
    if (svgState) {
      moveTimePosition(svgState);
    }
  }, [localTimePosition]);

  return (
    <div className="timeline">
      <div ref={ref} />
    </div>
  );
};

export default TimeLine;
