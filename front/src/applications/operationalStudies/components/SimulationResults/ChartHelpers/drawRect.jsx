/* eslint-disable no-unused-vars */
const drawRect = (
  chart,
  classes,
  dataSimulation,
  groupID,
  interpolation,
  keyValues,
  name,
  rotate,
  isSelected = true,
  id = null
) => {
  const width = rotate
    ? chart.x(dataSimulation[`${keyValues[1]}_end`]) -
      chart.x(dataSimulation[`${keyValues[1]}_start`])
    : chart.x(dataSimulation[`${keyValues[0]}_end`]) -
      chart.x(dataSimulation[`${keyValues[0]}_start`]);

  const height = rotate
    ? chart.y(dataSimulation[`${keyValues[0]}_end`]) -
      chart.y(dataSimulation[`${keyValues[0]}_start`])
    : chart.y(dataSimulation[`${keyValues[1]}_end`]) -
      chart.y(dataSimulation[`${keyValues[1]}_start`]);

  const drawZone = chart.drawZone.select(`#${groupID}`);
  drawZone
    .append('rect')
    .attr('id', id)
    .attr('class', `rect zoomable ${classes}`)
    .datum(dataSimulation)
    .attr('fill', dataSimulation.color)
    .attr('stroke-width', 1)
    .attr('stroke', dataSimulation.color)
    .attr(
      'x',
      chart.x(
        rotate ? dataSimulation[`${keyValues[1]}_start`] : dataSimulation[`${keyValues[0]}_start`]
      )
    )
    .attr(
      'y',
      chart.y(
        rotate ? dataSimulation[`${keyValues[0]}_start`] : dataSimulation[`${keyValues[1]}_start`]
      ) -
        height * -1
    )
    .attr('width', width)
    .attr('height', height * -1);
};

export default drawRect;
