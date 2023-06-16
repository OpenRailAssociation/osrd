import * as d3 from 'd3';

export default function drawBPCC(data, chartRef) {
  // SVG element dimensions
  const svgWidth = 600;
  const svgHeight = 200;

  // Scale configuration
  const xScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.max)]) // Use other attributes if needed
    .range([0, svgWidth]);

  // Create or select the SVG element using the provided chart reference
  const svg = d3.select(chartRef).append('svg').attr('width', svgWidth).attr('height', svgHeight);

  // Create the intervals
  const intervalSelection = svg
    .selectAll('.interval')
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'interval')
    .attr('x', 0)
    .attr('y', (d, i) => i * 40) // Vertical position of the intervals
    .attr('width', (d) => xScale(d.max))
    .attr('height', 30)
    .attr('fill', 'steelblue'); // Color of the intervals

  // Add any additional elements, such as axes
}
