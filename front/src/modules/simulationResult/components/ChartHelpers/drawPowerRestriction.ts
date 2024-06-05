import { pointer } from 'd3-selection';

import type { DrawingKeys } from 'applications/operationalStudies/consts';
import i18n from 'i18n';
import getAxisValues from 'modules/simulationResult/components/ChartHelpers/drawHelpers';
import type { PowerRestrictionSegment } from 'modules/simulationResult/components/SpeedSpaceChart/types';
import type { Chart } from 'reducers/osrdsimulation/types';

import { buildStripe } from './ChartHelpers';

const drawPowerRestriction = (
  chart: Chart,
  classes: string,
  powerRestrictionSegment: PowerRestrictionSegment,
  groupID: string,
  keyValues: DrawingKeys,
  isStripe: boolean,
  isIncompatible: boolean,
  isRestriction: boolean,
  id: string,
  isElectricalSettings = false
) => {
  // Get the different axis values based on rotation
  // x
  const xValues = getAxisValues(powerRestrictionSegment, keyValues, 0);
  // y
  const yValues = getAxisValues(powerRestrictionSegment, keyValues, 1);

  const width = chart.x(xValues.end) - chart.x(xValues.start);
  const height = chart.y(yValues.end) - chart.y(yValues.start);

  const margin = isElectricalSettings ? 26 : 0;

  // prepare stripe pattern
  if (isStripe) {
    buildStripe(chart.drawZone.select(`#${groupID}`), { id, color: '#333' });
  }

  const drawZone = chart.drawZone.select(`#${groupID}`);

  // add main rect for profile displayed
  drawZone
    .append('rect')
    .attr('id', id)
    .attr('class', `rect main ${classes}`)
    .datum(powerRestrictionSegment)
    .attr('fill', isStripe ? `url(#${id})` : '#333')
    .attr('stroke-width', 1)
    .attr('x', chart.x(xValues.start + margin))
    .attr('y', chart.y(yValues.start + margin) + height)
    .attr('width', width)
    .attr('height', height * -1);

  // add text to main rect
  const addTextZone = () => {
    if (width > 60) {
      const textZone = chart.drawZone.select(`#${groupID}`);

      // add rect for text zone
      textZone
        .append('rect')
        .attr('class', `rect electricalProfileTextBlock ${classes}`)
        .attr('fill', '#FFF')
        .attr('transform', 'translate(-25, -5.5)')
        .attr('rx', 2)
        .attr('ry', 2)
        .attr('x', chart.x(xValues.middle + margin))
        .attr('y', chart.y(yValues.start - (yValues.end - yValues.middle - margin)) + height)
        .attr('width', '3.2em')
        .attr('height', '0.6em');

      // add text to text zone
      textZone
        .append('text')
        .attr('class', `electricalProfileText ${classes}`)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'middle')
        .text(powerRestrictionSegment.seenRestriction)
        .attr('fill', '#333')
        .attr('font-size', 8)
        .attr('font-weight', 'bold')
        .attr('x', chart.x(xValues.middle + margin))
        .attr('y', chart.y(yValues.start - (yValues.end - yValues.middle - margin)) + height);
    }
  };

  drawZone.call(addTextZone);

  // create pop-up when hovering rect-profile
  drawZone
    .selectAll(`.${classes}`)
    .on('mouseover', (event) => {
      const lastPosition = chart.x(powerRestrictionSegment.lastPosition);
      const pointerPositionX = pointer(event, event.currentTarget)[0];
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

      drawZone
        .select(`.${classes} `)
        .attr('transform', 'translate(0, -4)')
        .attr('height', (height - 8) * -1)
        .append('rect')
        .attr('class', `rect data`)
        .attr('fill', '#FFF')
        .attr('rx', 4)
        .attr('ry', 4)
        .attr('transform', `translate(${0 - popUpPosition}, -45)`)
        .attr('x', pointerPositionX)
        .attr('y', chart.y(yValues.start + margin) + height)
        .attr('width', popUpWidth)
        .attr('height', 35);

      // add restriction pop-up text
      let text;

      if (isRestriction) {
        text = `${powerRestrictionSegment.seenRestriction} ${i18n.t('powerRestriction.used', {
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
        .attr('transform', `translate(${8 - popUpPosition}, -27)`)
        .attr('x', pointerPositionX)
        .attr('y', chart.y(yValues.start + margin) + height);
    })
    // add mouse-out interraction to remove pop-up
    .on('mouseout', () => {
      drawZone
        .select(`.${classes} `)
        .attr('transform', 'translate(0, 0)')
        .attr('width', width)
        .attr('height', height * -1);
      drawZone.selectAll('.data').remove();
    });
};

export default drawPowerRestriction;
