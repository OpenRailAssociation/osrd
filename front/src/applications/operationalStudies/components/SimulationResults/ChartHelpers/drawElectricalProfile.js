/* eslint-disable no-unused-vars */
const drawElectricalProfile = (
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

  if (isStripe) {
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
  }

  const zone = chart.drawZone.select(`#${groupID}`);
  zone

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
    if ((rotate && height < -24) || (!rotate && width > 60)) {
      const textZone = chart.drawZone.select(`#${groupID}`);
      textZone
        .append('rect')
        .attr('class', `rect zoomable electricalProfileTextBlock ${classes}`)
        .attr('fill', '#FFF')
        .attr('transform', rotate ? 'translate(0, -10)' : 'translate(-25, 2)')
        .attr('rx', 2)
        .attr('ry', 2)
        .attr(
          'x',
          chart.x(
            rotate
              ? dataSimulation[`${keyValues[1]}_start`] + 2
              : dataSimulation[`${keyValues[0]}_middle`]
          )
        )
        .attr(
          'y',
          chart.y(
            rotate
              ? dataSimulation[`${keyValues[0]}_start`] -
                  (dataSimulation[`${keyValues[0]}_end`] - dataSimulation[`${keyValues[0]}_middle`])
              : dataSimulation[`${keyValues[1]}_start`]
          ) -
            height * -1
        )
        .attr('width', '3.2rem')
        .attr('height', rotate ? 20 : (height + 4) * -1);

      textZone
        .append('text')
        .attr('class', `electricalProfileText ${classes}`)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'middle')
        .text(dataSimulation.text)
        .attr('fill', dataSimulation.textColor)
        .attr('font-size', 10)
        .attr('font-style', isIncompatible ? 'italic' : 'normal')
        .attr('font-weight', 'bold')
        .attr(
          'x',
          chart.x(
            rotate
              ? dataSimulation[`${keyValues[1]}_start`] + 6
              : dataSimulation[`${keyValues[0]}_middle`]
          )
        )
        .attr(
          'y',
          chart.y(
            rotate
              ? dataSimulation[`${keyValues[0]}_start`] -
                  (dataSimulation[`${keyValues[0]}_end`] - dataSimulation[`${keyValues[0]}_middle`])
              : dataSimulation[`${keyValues[1]}_start`] - 7
          ) -
            height * -1
        );
    }
  };

  zone.call(addTextZone);

  zone
    .selectAll(`.${classes}`)
    .on('mouseover', () => {
      zone
        .append('rect')
        .attr('class', `rect zoomable data`)
        .attr('fill', '#FFF')
        .attr('stroke-width', 1)
        .attr('stroke', '#333')
        .attr('rx', 4)
        .attr('ry', 4)
        .attr(
          'transform',
          rotate ? 'translate(80, 0)' : `translate(0, ${isIncompatible ? '-60' : '-40'} )`
        )
        .attr(
          'x',
          chart.x(
            rotate
              ? dataSimulation[`${keyValues[1]}_start`]
              : dataSimulation[`${keyValues[0]}_start`]
          )
        )
        .attr(
          'y',
          chart.y(
            rotate
              ? dataSimulation[`${keyValues[0]}_start`]
              : dataSimulation[`${keyValues[1]}_start`]
          ) -
            height * -1
        )
        .attr('width', 160)
        .attr('height', isIncompatible ? 55 : 35);

      zone
        .append('rect')
        .attr('class', `rect zoomable data`)
        .attr('fill', isStripe ? `url(#${id})` : dataSimulation.textColor)
        .attr('stroke-width', 1)
        .attr('stroke', isStripe ? `url(#${id})` : dataSimulation.textColor)
        .attr(
          'transform',
          rotate ? 'translate(80, 0)' : `translate(5, ${isIncompatible ? '-42' : '-32'} )`
        )
        .attr(
          'x',
          chart.x(
            rotate
              ? dataSimulation[`${keyValues[1]}_start`]
              : dataSimulation[`${keyValues[0]}_start`]
          )
        )
        .attr(
          'y',
          chart.y(
            rotate
              ? dataSimulation[`${keyValues[0]}_start`]
              : dataSimulation[`${keyValues[1]}_start`]
          ) -
            height * -1
        )
        .attr('width', 30)
        .attr('height', 20);

      zone
        .append('text')
        .attr('class', `zoomable data`)
        .attr('dominant-baseline', 'middle')
        .text(
          isIncompatible
            ? `${dataSimulation.usedMode}V utilisé`
            : `${dataSimulation.usedMode}V ${dataSimulation.usedProfile || '?'}`
        )
        .attr(
          'transform',
          rotate ? 'translate(80, 0)' : `translate(45, ${isIncompatible ? '-40' : '-20'})`
        )
        .attr(
          'x',
          chart.x(
            rotate
              ? dataSimulation[`${keyValues[1]}_start`]
              : dataSimulation[`${keyValues[0]}_start`]
          )
        )
        .attr(
          'y',
          chart.y(
            rotate
              ? dataSimulation[`${keyValues[0]}_start`]
              : dataSimulation[`${keyValues[1]}_start`]
          ) -
            height * -1
        );

      if (isIncompatible) {
        zone
          .append('text')
          .attr('class', `zoomable data`)
          .attr('dominant-baseline', 'middle')
          .text(`${dataSimulation.usedProfile} incompatible`)
          .attr('transform', rotate ? 'translate(80, 0)' : `translate(45, -20)`)
          .attr(
            'x',
            chart.x(
              rotate
                ? dataSimulation[`${keyValues[1]}_start`]
                : dataSimulation[`${keyValues[0]}_start`]
            )
          )
          .attr(
            'y',
            chart.y(
              rotate
                ? dataSimulation[`${keyValues[0]}_start`]
                : dataSimulation[`${keyValues[1]}_start`]
            ) -
              height * -1
          );
      }
    })
    .on('mouseout', () => {
      zone.selectAll('.data').remove();
    });
};

export default drawElectricalProfile;
