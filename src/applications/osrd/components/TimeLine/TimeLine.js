import React, {
  useState, useEffect, useRef,
} from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import { sec2datetime } from 'utils/timeManipulation';
import { gridX } from 'applications/osrd/components/Helpers/ChartHelpers';

export default function TimeLine(props) {
  const { dataRange } = props;
  const { timePosition, chart } = useSelector((state) => state.osrdsimulation);
  const dispatch = useDispatch();
  const ref = useRef();

  const dimensions = {
    width: 800,
    height: 40,
    margin: {
      top: 0, right: 1, bottom: 20, left: 10,
    },
  };

  const drawChart = () => {
    if (d3.select(ref.current)) { d3.select(ref.current).select('svg').remove(); }
    const chartRect = chart.x.domain();

    const svg = d3.select(ref.current)
      .append('svg')
      // .attr('width', dimensions.width)
      // .attr('height', dimensions.height + dimensions.margin.bottom);
      .attr('viewBox', `0 0 ${dimensions.width + dimensions.margin.left + dimensions.margin.right} ${dimensions.height + dimensions.margin.top + dimensions.margin.bottom}`)
      .append('g')
      .attr('transform', `translate(${dimensions.margin.left},${dimensions.margin.top})`);

    svg.append('defs')
      .append('SVG:clipPath')
      .attr('id', 'timelineClipPath')
      .append('SVG:rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', dimensions.width)
      .attr('height', dimensions.height);

    const xScale = d3.scaleTime()
      .domain([sec2datetime(dataRange[0]), sec2datetime(dataRange[1])])
      .range([dimensions.margin.left, dimensions.width - dimensions.margin.right]);
    const yScale = d3.scaleLinear()
      .domain([0, 10])
      .range([0, dimensions.height]);
    const axisBottomX = d3.axisBottom(xScale).tickFormat(d3.timeFormat('%H:%M'));
    const axisLeftY = d3.axisLeft(yScale).ticks(0);
    svg.append('g')
      .attr('transform', `translate(0, ${dimensions.height})`)
      .call(axisBottomX);
    svg.append('g')
      .attr('transform', `translate(${dimensions.margin.left}, 0)`)
      .call(axisLeftY);
    svg.append('g')
      .attr('transform', `translate(0,${dimensions.height})`)
      .attr('class', 'grid')
      .call(gridX(xScale, dimensions.height));
    svg.append('g')
      .attr('clip-path', 'url(#timelineClipPath)');

    svg.append('rect')
      .attr('x', xScale(chartRect[0]))
      .attr('y', 1)
      .attr('width', xScale(chartRect[1]) - xScale(chartRect[0]))
      .attr('height', dimensions.height - 1)
      .attr('stroke', '#777')
      .attr('stroke-width', 2)
      .attr('fill', 'rgba(0, 0, 0, 0.05)');

  };

  useEffect(() => {
    if (chart) {
      drawChart();
    }
  }, [chart, dataRange]);

  return (
    <>
      <div ref={ref} />
    </>
  );
}

TimeLine.propTypes = {
  chartRect: PropTypes.array.isRequired,
  dataRange: PropTypes.array.isRequired,
};
