import { pointer } from 'd3-selection';
import i18n from 'i18n';
import { Chart } from 'reducers/osrdsimulation/types';
import { ElectricalConditionSegment, DrawingKeys } from 'applications/operationalStudies/consts';
import getAxisValues from 'modules/simulationResult/components/ChartHelpers/drawHelpers';
import { getElementWidth } from './ChartHelpers';

const ELECTRIFIED = 'Electrified';
const NEUTRAL = 'Neutral';

const drawElectricalProfile = (
  chart: Chart,
  classes: string,
  electricalConditionSegment: ElectricalConditionSegment,
  groupID: string,
  keyValues: DrawingKeys,
  isStripe: boolean,
  isIncompatible: boolean,
  id: string
) => {
  const electrificationType = electricalConditionSegment.electrification.object_type;
  const electrificationProfile =
    electrificationType === ELECTRIFIED
      ? electricalConditionSegment.electrification.profile
      : undefined;
  const electrificationMode =
    electrificationType === ELECTRIFIED
      ? electricalConditionSegment.electrification.mode
      : undefined;

  // Get the different axis values based on rotation
  // x
  const xValues = getAxisValues(electricalConditionSegment, keyValues, 0);
  // y
  const yValues = getAxisValues(electricalConditionSegment, keyValues, 1);

  const width = chart.x(xValues.end) - chart.x(xValues.start);
  const height = chart.y(yValues.end) - chart.y(yValues.start);

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
      .attr('stroke', electricalConditionSegment.color)
      .attr('stroke-width', 2.5);
  }

  const drawZone = chart.drawZone.select(`#${groupID}`);

  // add main rect for profile displayed
  drawZone
    .append('rect')
    .attr('id', id)
    .attr('class', `rect main ${classes}`)
    .datum(electricalConditionSegment)
    .attr('fill', isStripe ? `url(#${id})` : electricalConditionSegment.color)
    .attr('stroke-width', 1)
    .attr('stroke', isStripe ? `url(#${id})` : electricalConditionSegment.color)
    .attr('x', chart.x(xValues.start))
    .attr('y', chart.y(yValues.start) + height)
    .attr('width', width)
    .attr('height', height * -1);

  /**  Adds text to the main rect */
  const addTextZone = () => {
    if (width > 60) {
      const textZone = chart.drawZone.select(`#${groupID}`);

      // get the width of the text element and adding a few pixels for readability
      const labelFontSize = 8; // in px
      const svgWidth =
        getElementWidth(electricalConditionSegment.text, labelFontSize, `#${groupID}`) + 10;

      // add rect for text zone
      textZone
        .append('rect')
        .attr('class', `rect electricalProfileTextBlock ${classes}`)
        .attr('fill', '#FFF')
        .attr('transform', `translate(-${svgWidth / 2}, -5.5)`)
        .attr('rx', 2)
        .attr('ry', 2)
        .attr('x', chart.x(xValues.middle))
        .attr('y', chart.y(yValues.start - (yValues.end - yValues.middle)) + height)
        .attr('width', svgWidth)
        .attr('height', '0.6em');

      // add text to text zone
      textZone
        .append('text')
        .attr('class', `electricalProfileText ${classes}`)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'middle')
        .text(electricalConditionSegment.text)
        .attr('fill', electricalConditionSegment.textColor)
        .attr('font-size', 8)
        .attr('font-weight', 'bold')
        .attr('x', chart.x(xValues.middle))
        .attr('y', chart.y(yValues.start - (yValues.end - yValues.middle)) + height);
    }
  };

  if (
    (electrificationType === ELECTRIFIED &&
      electricalConditionSegment.electrification.mode_handled) ||
    (electrificationType === NEUTRAL && electricalConditionSegment.electrification.lower_pantograph)
  )
    drawZone.call(addTextZone);

  // create pop-up when hovering rect-profile
  drawZone
    .selectAll(`.${classes}`)
    .on('mouseover', (event) => {
      const lastPosition = chart.x(electricalConditionSegment.lastPosition);
      const pointerPositionX = pointer(event, event.currentTarget)[0];
      let popUpWidth;

      if (!electrificationProfile) {
        popUpWidth = 175;
      } else if (electrificationMode === '1500V') {
        popUpWidth = 125;
      } else {
        popUpWidth = 165;
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
        .attr(
          'transform',
          `translate(${0 - popUpPosition}, ${
            isIncompatible || !electrificationProfile ? '-65' : '-45'
          } )`
        )
        .attr('x', pointerPositionX)
        .attr('y', chart.y(yValues.start) + height)
        .attr('width', popUpWidth)
        .attr('height', isIncompatible || !electrificationProfile ? 55 : 35);

      // add profile pop-up rect
      drawZone
        .append('rect')
        .attr('class', `rect data`)
        .attr('fill', isStripe ? `url(#${id})` : electricalConditionSegment.textColor)
        .attr('stroke-width', 1)
        .attr('stroke', isStripe ? `url(#${id})` : electricalConditionSegment.textColor)
        .attr(
          'transform',
          `translate(${8 - popUpPosition}, ${
            isIncompatible || !electrificationProfile ? '-47' : '-37'
          } )`
        )
        .attr('x', pointerPositionX)
        .attr('y', chart.y(yValues.start) + height)
        .attr('width', electrificationMode === '1500V' ? 20 : 28)
        .attr('height', 20);

      // add profile pop-up text
      if (electrificationType !== ELECTRIFIED) {
        drawZone
          .append('text')
          .attr('class', `data`)
          .attr('dominant-baseline', 'middle')
          .text(
            `${i18n.t('electricalProfiles.notElectrified', {
              ns: 'simulation',
            })}`
          )
          .attr(
            'transform',
            `translate(${48 - popUpPosition}, ${
              isIncompatible || !electrificationProfile ? '-37' : '-25'
            })`
          )
          .attr('x', pointerPositionX)
          .attr('y', chart.y(yValues.start) + height);
      } else {
        drawZone
          .append('text')
          .attr('class', `data`)
          .attr('dominant-baseline', 'middle')
          .text(
            isIncompatible || !electrificationProfile
              ? `${electrificationMode} ${i18n.t('electricalProfiles.used', {
                  ns: 'simulation',
                })}`
              : `${electrificationMode} ${electrificationProfile}`
          )
          .attr(
            'transform',
            `translate(${48 - popUpPosition}, ${
              isIncompatible || !electrificationProfile ? '-45' : '-25'
            })`
          )
          .attr('x', pointerPositionX)
          .attr('y', chart.y(yValues.start) + height);

        if (isIncompatible || !electrificationProfile) {
          drawZone
            .append('text')
            .attr('class', `data`)
            .attr('dominant-baseline', 'middle')
            .text(
              electrificationProfile
                ? `${electrificationProfile} ${i18n.t('electricalProfiles.incompatible', {
                    ns: 'simulation',
                  })}`
                : `${i18n.t('electricalProfiles.missingProfile', {
                    ns: 'simulation',
                  })}`
            )
            .attr('transform', `translate(${48 - popUpPosition}, -25)`)
            .attr('x', pointerPositionX)
            .attr('y', chart.y(yValues.start) + height);
        }
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
