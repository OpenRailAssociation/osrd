import { pointer } from 'd3-selection';
import i18n from 'i18n';

const drawPowerRestriction = (
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
  isRestriction,
  isElectricalSettings = false,
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

  let margin = 0;
  if (isElectricalSettings) margin = 26;

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
      .attr('stroke', '#333')
      .attr('stroke-width', 2.5);
  }

  const drawZone = chart.drawZone.select(`#${groupID}`);

  drawZone

    // add main rect for profile displayed
    .append('rect')
    .attr('id', id)
    .attr('class', `rect main ${classes}`)
    .datum(dataSimulation)
    .attr('fill', isStripe ? `url(#${id})` : '#333')
    .attr('stroke-width', 1)
    .attr(
      'x',
      chart.x(
        rotate
          ? dataSimulation[`${keyValues[1]}_start`] + margin
          : dataSimulation[`${keyValues[0]}_start`] + margin
      )
    )
    .attr(
      'y',
      chart.y(
        rotate
          ? dataSimulation[`${keyValues[0]}_start`] + margin
          : dataSimulation[`${keyValues[1]}_start`] + margin
      ) -
        height * -1
    )
    .attr('width', width)
    .attr('height', height * -1);

  // add text to main rect
  const addTextZone = () => {
    if ((rotate && height < -margin) || (!rotate && width > 60)) {
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
              ? dataSimulation[`${keyValues[1]}_middle`] + margin
              : dataSimulation[`${keyValues[0]}_middle`] + margin
          )
        )
        .attr(
          'y',
          chart.y(
            rotate
              ? dataSimulation[`${keyValues[0]}_start`] +
                  margin -
                  (dataSimulation[`${keyValues[0]}_end`] +
                    margin -
                    dataSimulation[`${keyValues[0]}_middle`] -
                    margin)
              : dataSimulation[`${keyValues[1]}_start`] -
                  (dataSimulation[`${keyValues[1]}_end`] -
                    dataSimulation[`${keyValues[1]}_middle`] -
                    margin)
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
        .text(dataSimulation.usedRestriction)
        .attr('fill', '#333')
        .attr('font-size', 8)
        .attr('font-weight', 'bold')
        .attr(
          'x',
          chart.x(
            rotate
              ? dataSimulation[`${keyValues[1]}_start`] +
                  (dataSimulation[`${keyValues[1]}_end`] -
                    dataSimulation[`${keyValues[1]}_middle`] +
                    margin)
              : dataSimulation[`${keyValues[0]}_middle`] + margin
          )
        )
        .attr(
          'y',
          chart.y(
            rotate
              ? dataSimulation[`${keyValues[0]}_start`] -
                  (dataSimulation[`${keyValues[0]}_end`] -
                    dataSimulation[`${keyValues[0]}_middle`] -
                    margin)
              : dataSimulation[`${keyValues[1]}_start`] -
                  (dataSimulation[`${keyValues[1]}_end`] -
                    dataSimulation[`${keyValues[1]}_middle`] -
                    margin)
          ) -
            height * -1
        );
    }
  };

  if (!isIncompatible && isRestriction) drawZone.call(addTextZone);

  // create pop-up when hovering rect-profile
  drawZone
    .selectAll(`.${classes}`)
    .on('mouseover', (event) => {
      const lastPosition = chart.x(dataSimulation.lastPosition);
      const pointerPositionX = pointer(event, event.currentTarget)[0];
      const pointerPositionY = pointer(event, event.currentTarget)[1];
      let popUpWidth;

      if (isRestriction) {
        popUpWidth = isIncompatible ? 225 : 120;
      } else {
        popUpWidth = 290;
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
        .attr('transform', rotate ? 'translate(80, 0)' : `translate(${0 - popUpPosition}, -45)`)
        .attr('x', pointerPositionX)
        .attr(
          'y',
          rotate
            ? pointerPositionY + margin
            : chart.y(dataSimulation[`${keyValues[1]}_start`] + margin) - height * -1
        )
        .attr('width', popUpWidth)
        .attr('height', 35);

      // add restriction pop-up text
      let text;

      if (isRestriction) {
        text = `${dataSimulation.usedRestriction} ${i18n.t('powerRestriction.used', {
          ns: 'simulation',
        })}`;
      } else {
        text = i18n.t('powerRestriction.incompatible', {
          ns: 'simulation',
        });
      }

      drawZone
        .append('text')
        .attr('class', `data`)
        .attr('dominant-baseline', 'middle')
        .text(text)
        .attr('transform', rotate ? `translate(88, 19)` : `translate(${8 - popUpPosition}, -27)`)
        .attr('x', pointerPositionX)
        .attr(
          'y',
          rotate
            ? pointerPositionY + margin
            : chart.y(dataSimulation[`${keyValues[1]}_start`] + margin) - height * -1
        );
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

export default drawPowerRestriction;
