const drawLegendToggle = (chart, classes, groupID, legend, text, isSelected = false) => {
  const drawZone = chart.drawZone.select(`#${groupID}`);

  drawZone
    .append('circle')
    .attr('class', `circle ${classes}`)
    .style('fill', '#FFF')
    .attr('stroke-width', 1.5)
    .attr('stroke', '#303383')
    .attr('cy', '12%')
    .attr('cx', '5%')
    .attr('r', 18);

  drawZone
    .append('text')
    .attr('class', `circleText ${classes}`)
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'middle')
    .text(text)
    .attr('fill', '#303383')
    .attr('font-size', 15)
    .attr('font-weight', 'bolder')
    .attr('y', '13%')
    .attr('x', '5%');

  drawZone.selectAll(`.${classes}`).on('click', () => {
    isSelected = !isSelected;

    if (isSelected) {
      drawZone.select('.circle').style('fill', '#303383');
      drawZone.select('.circleText').attr('fill', '#FFF');
    } else {
      drawZone.select('.circle').style('fill', '#FFF');
      drawZone.select('.circleText').attr('fill', '#303383');
    }
  });
};

export default drawLegendToggle;
