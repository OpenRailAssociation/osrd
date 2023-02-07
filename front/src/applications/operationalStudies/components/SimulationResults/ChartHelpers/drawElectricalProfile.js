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

  // prepare stripe pattern
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

  const drawZone = chart.drawZone.select(`#${groupID}`);
  drawZone

    // add main rect for profile displayed
    .append('rect')
    .attr('id', id)
    .attr('class', `rect ${classes}`)
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

  // add text to main rect
  const addTextZone = () => {
    if ((rotate && height < -24) || (!rotate && width > 60)) {
      const textZone = chart.drawZone.select(`#${groupID}`);

      // add rect for text zone
      textZone
        .append('rect')
        .attr('class', `rect electricalProfileTextBlock ${classes}`)
        .attr('fill', '#FFF')
        .attr('transform', rotate ? 'translate(0, -10)' : 'translate(-25, -10)')
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
              : dataSimulation[`${keyValues[1]}_start`] -
                  (dataSimulation[`${keyValues[1]}_end`] - dataSimulation[`${keyValues[1]}_middle`])
          ) -
            height * -1
        )
        .attr('width', rotate ? '9%' : '3.2rem')
        .attr('height', rotate ? 20 : '1.2rem');

      // add text to text zone
      textZone
        .append('text')
        .attr('class', `electricalProfileText ${classes}`)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'middle')
        .text(dataSimulation.text)
        .attr('fill', dataSimulation.textColor)
        .attr('font-size', 10)
        .attr('font-weight', 'bold')
        .attr(
          'x',
          chart.x(
            rotate
              ? dataSimulation[`${keyValues[1]}_start`] +
                  (dataSimulation[`${keyValues[1]}_end`] - dataSimulation[`${keyValues[1]}_middle`])
              : dataSimulation[`${keyValues[0]}_middle`]
          )
        )
        .attr(
          'y',
          chart.y(
            rotate
              ? dataSimulation[`${keyValues[0]}_start`] -
                  (dataSimulation[`${keyValues[0]}_end`] - dataSimulation[`${keyValues[0]}_middle`])
              : dataSimulation[`${keyValues[1]}_start`] -
                  (dataSimulation[`${keyValues[1]}_end`] - dataSimulation[`${keyValues[1]}_middle`])
          ) -
            height * -1
        );
    }
  };

  drawZone.call(addTextZone);

  // add hover interraction
  drawZone
    .selectAll(`.${classes}`)
    .on('mouseover', () => {
      drawZone
        .append('rect')
        .attr('class', `rect data`)
        .attr('fill', '#FFF')
        .attr('rx', 4)
        .attr('ry', 4)
        .attr(
          'transform',
          rotate
            ? 'translate(80, 0)'
            : `translate(0, ${isIncompatible || !dataSimulation.usedProfile ? '-60' : '-40'} )`
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
        .attr('width', () => {
          if (!dataSimulation.usedProfile) {
            return 175;
          }
          if (dataSimulation.usedMode === '1500') {
            return 125;
          }
          return 165;
        })
        .attr('height', isIncompatible || !dataSimulation.usedProfile ? 55 : 35);

      // add profile pop-up rect
      drawZone
        .append('rect')
        .attr('class', `rect data`)
        .attr('fill', isStripe ? `url(#${id})` : dataSimulation.textColor)
        .attr('stroke-width', 1)
        .attr('stroke', isStripe ? `url(#${id})` : dataSimulation.textColor)
        .attr(
          'transform',
          rotate
            ? `translate(88, ${isIncompatible || !dataSimulation.usedProfile ? '16' : '8'})`
            : `translate(8, ${isIncompatible || !dataSimulation.usedProfile ? '-42' : '-32'} )`
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
        .attr('width', dataSimulation.usedMode === 1500 ? 20 : 28)
        .attr('height', 20);

      // add profile pop-up text
      drawZone
        .append('text')
        .attr('class', `data`)
        .attr('dominant-baseline', 'middle')
        .text(
          isIncompatible || !dataSimulation.usedProfile
            ? `${dataSimulation.usedMode}V utilisé`
            : `${dataSimulation.usedMode}V ${dataSimulation.usedProfile}`
        )
        .attr(
          'transform',
          rotate
            ? `translate(123,${isIncompatible || !dataSimulation.usedProfile ? 18 : 20})`
            : `translate(48, ${isIncompatible || !dataSimulation.usedProfile ? '-40' : '-20'})`
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

      if (isIncompatible || !dataSimulation.usedProfile) {
        drawZone
          .append('text')
          .attr('class', `data`)
          .attr('dominant-baseline', 'middle')
          .text(
            dataSimulation.usedProfile
              ? `${dataSimulation.usedProfile} incompatible`
              : `profil manquant`
          )
          .attr('transform', rotate ? 'translate(123, 40)' : `translate(48, -20)`)
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
      // add mouse-out interraction to remove pop-up
      drawZone.selectAll('.data').remove();
    });
};

export default drawElectricalProfile;
