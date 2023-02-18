import { pointer } from 'd3-selection';
import i18n from 'i18n';

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
    .attr('class', `rect main ${classes}`)
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
        .attr('transform', rotate ? 'translate(-20, -10)' : 'translate(-25, -5.5)')
        .attr('rx', 2)
        .attr('ry', 2)
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
              ? dataSimulation[`${keyValues[0]}_start`] -
                  (dataSimulation[`${keyValues[0]}_end`] - dataSimulation[`${keyValues[0]}_middle`])
              : dataSimulation[`${keyValues[1]}_start`] -
                  (dataSimulation[`${keyValues[1]}_end`] - dataSimulation[`${keyValues[1]}_middle`])
          ) -
            height * -1
        )
        .attr('width', rotate ? 40 : '3.2em')
        .attr('height', rotate ? 20 : '0.6em');

      // add text to text zone
      textZone
        .append('text')
        .attr('class', `electricalProfileText ${classes}`)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'middle')
        .text(dataSimulation.text)
        .attr('fill', dataSimulation.textColor)
        .attr('font-size', 8)
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

  // create pop-up when hovering rect-profile
  drawZone
    .selectAll(`.${classes}`)
    .on('mouseover', (event) => {
      const lastPosition = chart.x(dataSimulation.lastPosition);
      const pointerPositionX = pointer(event, event.currentTarget)[0];
      const pointerPositionY = pointer(event, event.currentTarget)[1];
      let popUpWidth;

      if (!dataSimulation.usedProfile) {
        popUpWidth = 175;
      } else if (dataSimulation.usedMode === '1500') {
        popUpWidth = 125;
      } else {
        popUpWidth = 165;
      }

      let popUpPosition = 0;
      if (pointerPositionX + popUpWidth > lastPosition) {
        popUpPosition = pointerPositionX + popUpWidth - lastPosition;
      }

      if (rotate) {
        drawZone
          .select(`.${classes} `)
          .attr('transform', 'translate(-4, 0)')
          .attr('width', width + 8);
      } else {
        drawZone
          .select(`.${classes} `)
          .attr('transform', 'translate(0, -4)')
          .attr('height', (height - 8) * -1);
      }

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
            : `translate(${0 - popUpPosition}, ${
                isIncompatible || !dataSimulation.usedProfile ? '-65' : '-45'
              } )`
        )
        .attr('x', pointerPositionX)
        .attr(
          'y',
          rotate ? pointerPositionY : chart.y(dataSimulation[`${keyValues[1]}_start`]) - height * -1
        )
        .attr('width', popUpWidth)
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
            : `translate(${8 - popUpPosition}, ${
                isIncompatible || !dataSimulation.usedProfile ? '-47' : '-37'
              } )`
        )
        .attr('x', pointerPositionX)
        .attr(
          'y',
          rotate ? pointerPositionY : chart.y(dataSimulation[`${keyValues[1]}_start`]) - height * -1
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
            ? `${dataSimulation.usedMode}V ${i18n.t('electricalProfiles.used', {
                ns: 'simulation',
              })}`
            : `${dataSimulation.usedMode}V ${dataSimulation.usedProfile}`
        )
        .attr(
          'transform',
          rotate
            ? `translate(123,${isIncompatible || !dataSimulation.usedProfile ? 18 : 20})`
            : `translate(${48 - popUpPosition}, ${
                isIncompatible || !dataSimulation.usedProfile ? '-45' : '-25'
              })`
        )
        .attr('x', pointerPositionX)
        .attr(
          'y',
          rotate ? pointerPositionY : chart.y(dataSimulation[`${keyValues[1]}_start`]) - height * -1
        );

      if (isIncompatible || !dataSimulation.usedProfile) {
        drawZone
          .append('text')
          .attr('class', `data`)
          .attr('dominant-baseline', 'middle')
          .text(
            dataSimulation.usedProfile
              ? `${dataSimulation.usedProfile} ${i18n.t('electricalProfiles.incompatible', {
                  ns: 'simulation',
                })}`
              : `${i18n.t('electricalProfiles.missingProfile', {
                  ns: 'simulation',
                })}`
          )
          .attr(
            'transform',
            rotate ? 'translate(123, 40)' : `translate(${48 - popUpPosition}, -25)`
          )
          .attr('x', pointerPositionX)
          .attr(
            'y',
            rotate
              ? pointerPositionY
              : chart.y(dataSimulation[`${keyValues[1]}_start`]) - height * -1
          );
      }
    })
    .on('mouseout', () => {
      // add mouse-out interraction to remove pop-up
      drawZone
        .select(`.${classes} `)
        .attr('transform', 'translate(0, 0)')
        .attr('width', width)
        .attr('height', height * -1);
      drawZone.selectAll('.data').remove();
    });
};

export default drawElectricalProfile;
