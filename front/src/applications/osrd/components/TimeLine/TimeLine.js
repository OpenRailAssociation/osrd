import * as d3 from 'd3';

import React, { useEffect, useRef, useState } from 'react';
import { getDirection, gridX } from 'applications/osrd/components/Helpers/ChartHelpers';
import { sec2datetime, time2datetime } from 'utils/timeManipulation';
import { updateChart, updateMustRedraw } from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';

const drawTrains = (trains, selectedTrain, xScale, svg, height) => {
  trains.forEach((train, idx) => {
    const startTime = train.base.stops[0].time;
    const endTime = train.base.stops[train.base.stops.length - 1].time;
    const direction = getDirection(train.base.head_positions);

    const y1 = direction ? height - 4 : 4;
    const y2 = direction ? 4 : height - 4;

    svg
      .append('line')
      .attr('class', selectedTrain === idx ? 'timeline-train selected' : 'timeline-train')
      .style('stroke-width', 2)
      .attr('x1', xScale(sec2datetime(startTime)))
      .attr('y1', y1)
      .attr('x2', xScale(sec2datetime(endTime)))
      .attr('y2', y2);
  });
};

export default function TimeLine() {
  const { chart, selectedTrain, timePosition } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const dispatch = useDispatch();
  const ref = useRef();
  const [svgState, setSvg] = useState(undefined);
  const dataRange = [
    d3.min(simulation.trains, (train) =>
      d3.min(train.base.head_positions, (section) => d3.min(section, (step) => step.time))
    ),
    d3.max(simulation.trains, (train) =>
      d3.max(train.base.head_positions, (section) => d3.max(section, (step) => step.time))
    ),
  ];

  const dimensions = {
    width: ref.current ? ref.current.offsetWidth : 800,
    height: 40,
    margin: {
      top: 0,
      right: 1,
      bottom: 20,
      left: 10,
    },
  };

  const moveTimePosition = (svg) => {
    const xScale = d3
      .scaleTime()
      .domain([sec2datetime(dataRange[0]), sec2datetime(dataRange[1])])
      .range([dimensions.margin.left, dimensions.width - dimensions.margin.right]);
    svg
      .select('#timePositionTimeLine')
      .attr('transform', `translate(${xScale(time2datetime(timePosition))},0)`);
  };

  const drawChart = () => {
    if (d3.select(ref.current)) {
      d3.select(ref.current).select('svg').remove();
    }
    const chartRect = chart.rotate ? chart.y.domain() : chart.x.domain();

    let dragValue = 0;

    const svg = d3
      .select(ref.current)
      .append('svg')
      // .attr('width', dimensions.width)
      // .attr('height', dimensions.height + dimensions.margin.bottom);
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
      .domain([sec2datetime(dataRange[0]), sec2datetime(dataRange[1])])
      .range([dimensions.margin.left, dimensions.width - dimensions.margin.right])
      .nice();
    const yScale = d3.scaleLinear().domain([0, 10]).range([0, dimensions.height]);
    const axisBottomX = d3.axisBottom(xScale).tickFormat(d3.timeFormat('%H:%M'));
    const axisLeftY = d3.axisLeft(yScale).ticks(0);
    svg
      .append('g')
      .attr('transform', `translate(0,${dimensions.height})`)
      .attr('class', 'grid')
      .call(gridX(xScale, dimensions.height));
    svg.selectAll('text').attr('class', 'd-none');
    svg.append('g').attr('transform', `translate(0, ${dimensions.height})`).call(axisBottomX);
    svg.append('g').attr('transform', `translate(${dimensions.margin.left}, 0)`).call(axisLeftY);
    svg.append('g').attr('clip-path', 'url(#timelineClipPath)');

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
      .attr('transform', `translate(${xScale(time2datetime(timePosition))},0)`);

    drawTrains(simulation.trains, selectedTrain, xScale, svg, dimensions.height);

    const drag = d3
      .drag()
      .on('end', () => {
        const delta = xScale.invert(dragValue) - xScale.domain()[0];
        const newX0 = new Date(chartRect[0].getTime() + delta);
        const newX1 = new Date(chartRect[1].getTime() + delta);
        dispatch(updateChart({ ...chart, x: chart.x.domain([newX0, newX1]) }));
        dispatch(updateMustRedraw(true));
      })
      .on('start', () => {})
      .on('drag', () => {
        dragValue += d3.event.dx;
        d3.select('#rectZoomTimeLine').attr('transform', `translate(${dragValue},0)`);
      });

    svg
      .append('rect')
      .attr('id', 'rectZoomTimeLine')
      .attr('x', xScale(chartRect[0]))
      .attr('y', 1)
      .attr('width', xScale(chartRect[1]) - xScale(chartRect[0]))
      .attr('height', dimensions.height - 1)
      .attr('stroke', '#777')
      .attr('stroke-width', 2)
      .attr('fill', 'rgba(0, 0, 0, 0.05)')
      .call(drag);

    setSvg(svg);
  };

  useEffect(() => {
    if (chart) {
      drawChart();
    }
  }, [chart]);

  useEffect(() => {
    if (svgState) {
      moveTimePosition(svgState);
    }
  }, [timePosition]);

  return (
    <div className="timeline-container flex-grow-1 w-100">
      <div className="timeline w-100">
        <div ref={ref} />
      </div>
    </div>
  );
}
