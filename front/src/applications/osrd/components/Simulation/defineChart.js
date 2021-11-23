import * as d3 from 'd3';
import { gridX, gridY } from 'applications/osrd/components/Helpers/ChartHelpers';
import nextId from 'react-id-generator';
import svgDefs from 'applications/osrd/components/Simulation/svgDefs';

const defineChart = (svgWidth, svgHeight, defineX, defineY, ref, rotate, keyValues, id) => {
  const margin = {
    top: 1, right: 1, bottom: 30, left: 55,
  };
  const width = svgWidth - margin.left - margin.right;
  const height = svgHeight - margin.top - margin.bottom;

  // Container for easy removing
  const svg = d3.select(ref.current)
    .append('div')
    .attr('id', id)
    .append('svg')
    // .attr('width', width + margin.left + margin.right)
    // .attr('height', height + margin.top + margin.bottom)
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    // .attr('perserveAspectRatio', 'xMinYMid')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // adding defs
  const defs = svg.append('defs');
  svgDefs(defs);

  // Add X axis
  const x = defineX.range([0, width]);
  const axisBottomX = !rotate && keyValues[0] === 'time'
    ? d3.axisBottom(x).tickFormat(d3.timeFormat('%H:%M:%S')) : d3.axisBottom(x);
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(axisBottomX);
  const xAxisGrid = svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .attr('class', 'grid')
    .call(gridX(x, height));

  // Add Y axis
  const y = defineY.range([height, 0]);
  const axisLeftY = rotate && keyValues[0] === 'time'
    ? d3.axisLeft(y).tickFormat(d3.timeFormat('%H:%M:%S')) : d3.axisLeft(y);
  const yAxis = svg.append('g')
    .call(axisLeftY);
  const yAxisGrid = svg.append('g')
    .attr('class', 'grid')
    .call(gridY(y, width));

  // Create clip path to hide everything out of this area
  const idClip = `clip-${nextId()}`;
  defs.append('SVG:clipPath')
    .attr('id', idClip)
    .append('SVG:rect')
    .attr('width', width)
    .attr('height', height)
    .attr('x', 0)
    .attr('y', 0);

  // background for zooming capabilities
  svg.append('rect')
    .attr('class', 'zoomable')
    .attr('width', width)
    .attr('height', height)
    .style('fill', 'none')
    .style('pointer-events', 'all');

  // define drawZones along type (line, area, etc.)
  const drawZone = svg.append('g')
    .attr('clip-path', `url(#${idClip})`);

  return {
    width,
    height,
    margin,
    x,
    xAxis,
    xAxisGrid,
    y,
    yAxis,
    yAxisGrid,
    svg,
    drawZone,
  };
};

export default defineChart;
