import { Chart } from 'reducers/osrdsimulation/types';

const drawText = (
  chart: Chart,
  direction: boolean,
  groupID: string,
  isSelected: boolean,
  text: string,
  x: Date,
  y: number
) => {
  const drawZone = chart.drawZone.select(`#${groupID}`);
  drawZone
    .append('text')
    .attr('class', `curve-label ${isSelected && 'selected'}`)
    .attr('x', chart.x(x))
    .attr('y', direction ? chart.y(y) + 15 : chart.y(y) - 5)
    .text(text);
};

export default drawText;
