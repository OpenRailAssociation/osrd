const drawText = (
  chart, direction, groupID, isSelected, text, x, y,
) => {
  const drawZone = chart.drawZone.select(`#${groupID}`);
  drawZone.append('text')
    .attr('class', `curve-label ${isSelected && 'selected'}`)
    .attr('x', direction
      ? chart.x(x)
      : chart.x(x))
    .attr('y', direction
      ? chart.y(y) + 15
      : chart.y(y) - 5)
    .text(text);
};

export default drawText;
