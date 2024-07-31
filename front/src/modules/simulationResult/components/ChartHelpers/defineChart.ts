import * as d3 from 'd3';
import { select as d3select } from 'd3-selection';
import nextId from 'react-id-generator';

import {
  gridX,
  gridY,
  gridY2,
} from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import svgDefs from 'modules/simulationResult/components/ChartHelpers/svgDefs';
import type { Chart, SimulationD3Scale } from 'reducers/osrdsimulation/types';

// TODO: remove this when spaceCurvesSlopes chart will be deleted
// keyValues ['position', 'gradient']
const defineChart = (
  svgWidth: number,
  svgHeight: number,
  defineX: SimulationD3Scale,
  defineY: SimulationD3Scale,
  ref: React.MutableRefObject<HTMLDivElement> | React.RefObject<HTMLDivElement>,
  rotate: boolean,
  id: string,
  defineY2?: SimulationD3Scale
): Chart => {
  const margin = {
    top: 10,
    right: 30,
    bottom: 30,
    left: 45,
  };
  const width = svgWidth - margin.left - margin.right;
  const height = svgHeight - margin.top - margin.bottom;

  // Container for easy removing
  const svg = d3select(ref.current)
    .append('div')
    .attr('id', id)
    .style('height', '100%')
    .append('svg')
    // .attr('width', width + margin.left + margin.right)
    // .attr('height', height + margin.top + margin.bottom)
    .attr(
      'viewBox',
      `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
    )
    .attr('preserveAspectRatio', 'none')
    .style('width', `100%`)
    .style('height', `100%`)
    .style('display', `inline-block`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // adding defs
  const defs = svg.append('defs');
  svgDefs(defs);

  // Add X axis
  const x = defineX.range([0, width]) as SimulationD3Scale;
  const axisBottomX = d3.axisBottom(x as d3.ScaleLinear<number, number>);
  const xAxis = svg.append('g').attr('transform', `translate(0,${height})`).call(axisBottomX);
  const xAxisGrid = svg
    .append('g')
    .attr('transform', `translate(0,${height})`)
    .attr('class', 'grid')
    .call(gridX(x, height));
  const originalScaleX = x; // We need to keep a ref on that to not double translation

  // Add Y axis
  const y = defineY.range([height, 0]) as SimulationD3Scale;
  const axisLeftY = d3.axisLeft(y);
  const yAxis = svg.append('g').call(axisLeftY);
  const yAxisGrid = svg.append('g').attr('class', 'grid').call(gridY(y, width));
  const originalScaleY = y; // We need to keep a ref on that to not double translation

  // Add Y axis on the right
  let rightAxis;

  if (defineY2) {
    const y2 = defineY2.range([height, 0]) as SimulationD3Scale;
    const axisRightY = d3.axisRight(y2);

    const y2Axis = svg.append('g').attr('transform', `translate(${width}, 0)`).call(axisRightY);
    const y2AxisGrid = svg
      .append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${width}, 0)`)
      .call(gridY2(y2, width));

    rightAxis = {
      y2,
      y2Axis,
      y2AxisGrid,
      originalScaleY2: y2,
    };
  }

  // Create clip path to hide everything out of this area
  const idClip = `clip-${nextId()}`;
  defs
    .append('SVG:clipPath')
    .attr('id', idClip)
    .append('SVG:rect')
    .attr('width', width)
    .attr('height', height)
    .attr('x', 0)
    .attr('y', 0);

  // background for zooming capabilities
  svg
    .append('rect')
    .attr('class', 'zoomable')
    .attr('width', width)
    .attr('height', height)
    .style('fill', 'none')
    .style('pointer-events', 'all');

  // define drawZones along type (line, area, etc.)
  const drawZone = svg.append('g').attr('clip-path', `url(#${idClip})`);

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
    originalScaleX,
    originalScaleY,
    rotate,
    ...rightAxis,
  };
};

export default defineChart;
