const drawGuideLines = (chart) => {
  chart.svg.selectAll('.guideLines').remove();

  // dashed lineguides
  chart.svg.append('line')
    .attr('id', 'vertical-line')
    .attr('class', 'guideLines')
    .attr('x1', 0)
    .attr('y1', chart.height)
    .attr('x2', 0)
    .attr('y2', 0);

  chart.svg.append('line')
    .attr('id', 'horizontal-line')
    .attr('class', 'guideLines')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', chart.width)
    .attr('y2', 0);
};

export default drawGuideLines;
