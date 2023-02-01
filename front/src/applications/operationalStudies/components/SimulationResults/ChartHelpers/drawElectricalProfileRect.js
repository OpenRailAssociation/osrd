/* eslint-disable no-unused-vars */
const drawElectricalProfileRect = (
  chart,
  classes,
  dataSimulation,
  groupID,
  interpolation,
  keyValues,
  name,
  rotate,
  isStripe,
  isIncompatible,
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

  const stripe = chart.drawZone.select(`#${groupID}`);
  stripe

    .append('pattern')
    .attr('id', `${id}`)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 8)
    .attr('height', 8)
    .append('path')
    .attr('d', 'M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4')
    .attr('stroke', dataSimulation.color)
    .attr('stroke-width', 2.5);

  const drawZone = chart.drawZone.select(`#${groupID}`);
  drawZone

    .append('rect')
    .attr('id', id)
    .attr('class', `rect zoomable ${classes}`)
    .datum(dataSimulation)
    .attr('fill', isStripe ? `url(#${id})` : dataSimulation.color)
    .attr('stroke-width', 1)
    .attr('stroke', isStripe ? `url(#${id})` : dataSimulation.color)
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

  const addTextZone = () => {
    if (width > 60) {
      const textZone = chart.drawZone.select(`#${groupID}`);
      textZone
        .append('rect')
        .attr('class', `rect zoomable electricalProfileTextBlock`)
        .attr('fill', '#FFF')
        .attr('transform', 'translate(-25, 0)')
        .attr(
          'x',
          chart.x(
            rotate
              ? dataSimulation[`${keyValues[1]}_middle`]
              : dataSimulation[`${keyValues[0]}_middle`]
          )
        )
        .attr(
          'y',
          chart.y(
            rotate
              ? dataSimulation[`${keyValues[0]}_start`] - 1
              : dataSimulation[`${keyValues[1]}_start`] - 1
          ) -
            height * -1
        )
        .attr('width', '50')
        .attr('height', (height + 4) * -1);

      textZone
        .append('text')
        .attr('class', `electricalProfileText`)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'middle')
        .text(dataSimulation.text)
        .attr('fill', dataSimulation.textColor)
        .attr('font-size', 10)
        .attr('font-style', isIncompatible ? 'italic' : 'normal')
        .attr(
          'x',
          chart.x(
            rotate
              ? dataSimulation[`${keyValues[1]}_middle`]
              : dataSimulation[`${keyValues[0]}_middle`]
          )
        )
        .attr(
          'y',
          chart.y(
            rotate
              ? dataSimulation[`${keyValues[0]}_middle`]
              : dataSimulation[`${keyValues[1]}_middle`]
          ) -
            height * -1
        );
    }
  };

  drawZone.call(addTextZone);
};

export default drawElectricalProfileRect;
