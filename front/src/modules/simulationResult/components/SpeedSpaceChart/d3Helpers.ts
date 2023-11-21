import drawArea from 'modules/simulationResult/components/ChartHelpers/drawArea';
import drawCurve from 'modules/simulationResult/components/ChartHelpers/drawCurve';
import defineChart from 'modules/simulationResult/components/ChartHelpers/defineChart';
import { defineLinear } from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import * as d3 from 'd3';
import {
  createProfileSegment,
  createPowerRestrictionSegment,
  DRAWING_KEYS,
} from 'applications/operationalStudies/consts';
import { isEmpty } from 'lodash';
import { Chart, SpeedSpaceChart, SpeedSpaceSettingsType } from 'reducers/osrdsimulation/types';
import drawElectricalProfile from 'modules/simulationResult/components/ChartHelpers/drawElectricalProfile';
import drawPowerRestriction from 'modules/simulationResult/components/ChartHelpers/drawPowerRestriction';
import { POSITION, SPEED, HEIGHT, CHART_AXES } from '../simulationResultsConsts';
import { GevPreparedData } from './prepareData';

/**
 * Typeguard to check if a selector is of type "Element"
 * @returns a boolean
 */
function isElement(selector: d3.BaseType): selector is Element {
  return selector !== null && 'clientHeight' in selector;
}

function createChart(
  CHART_ID: string,
  resetChart: boolean,
  trainSimulation: GevPreparedData,
  initialHeight: number,
  ref: React.RefObject<HTMLDivElement>,
  chart?: SpeedSpaceChart
) {
  d3.select(`#${CHART_ID}`).remove();

  let scaleX: d3.ScaleLinear<number, number, never>;
  let scaleY: d3.ScaleLinear<number, number, never>;
  let scaleY2: d3.ScaleLinear<number, number, never> = defineLinear(0, 0, 0);

  if (chart === undefined || resetChart) {
    const maxX = d3.max(trainSimulation.speed, (speedObject) => speedObject[POSITION]) as number;
    scaleX = defineLinear(maxX + 100);

    const maxY = d3.max(trainSimulation.speed, (speedObject) => speedObject[SPEED]) as number;
    scaleY = defineLinear(maxY);

    const minY2 = d3.min(
      trainSimulation.slopesCurve,
      (speedObject) => speedObject[HEIGHT]
    ) as number;
    const maxY2 = d3.max(
      trainSimulation.slopesCurve,
      (speedObject) => speedObject[HEIGHT]
    ) as number;
    scaleY2 = chart === undefined ? defineLinear(maxY2, 0, minY2) : chart.y2;
  } else {
    scaleX = chart.x;
    scaleY = chart.y;
    scaleY2 = chart.y2;
  }
  const width =
    d3.select(`#container-${CHART_ID}`) !== null
      ? parseInt(d3.select(`#container-${CHART_ID}`)?.style('width'), 10)
      : 250;
  const chartContainerElement = d3.select(`#container-${CHART_ID}`).node();

  const height =
    chartContainerElement !== null && isElement(chartContainerElement)
      ? chartContainerElement.clientHeight
      : initialHeight;

  return defineChart(
    width,
    height,
    scaleX,
    scaleY,
    ref,
    false, // not used for GEV
    CHART_AXES.SPACE_SPEED,
    CHART_ID,
    scaleY2
  );
}

function drawAxisTitle(chart: Chart) {
  chart.drawZone
    .append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('x', -10)
    .attr('y', 20)
    .text('KM/H');

  chart.drawZone
    .append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('x', chart.width - 10)
    .attr('y', chart.height - 10)
    .text('M');
}

function drawTrain(
  dataSimulation: GevPreparedData,
  speedSpaceSettings: SpeedSpaceSettingsType,
  chart: Chart
) {
  if (chart) {
    const chartLocal = chart;
    chartLocal.drawZone.select('g').remove();
    chartLocal.drawZone.append('g').attr('id', 'speedSpaceChart').attr('class', 'chartTrain');
    drawAxisTitle(chartLocal);

    drawArea(chartLocal, 'area speed', dataSimulation.areaBlock, 'speedSpaceChart', 'curveLinear');

    drawCurve(
      chartLocal,
      'speed',
      dataSimulation.speed,
      'speedSpaceChart',
      'curveLinear',
      CHART_AXES.SPACE_SPEED,
      'speed'
    );
    if (dataSimulation.margins_speed) {
      drawCurve(
        chartLocal,
        'speed margins',
        dataSimulation.margins_speed,
        'speedSpaceChart',
        'curveLinear',
        CHART_AXES.SPACE_SPEED,
        'margins_speed'
      );
    }
    if (dataSimulation.eco_speed) {
      drawCurve(
        chartLocal,
        'speed eco',
        dataSimulation.eco_speed,
        'speedSpaceChart',
        'curveLinear',
        CHART_AXES.SPACE_SPEED,
        'eco_speed'
      );
    }
    if (dataSimulation.vmax && speedSpaceSettings.maxSpeed) {
      drawCurve(
        chartLocal,
        'speed vmax',
        dataSimulation.vmax,
        'speedSpaceChart',
        'curveLinear',
        CHART_AXES.SPACE_SPEED,
        'vmax'
      );
    }
    if (dataSimulation.slopesCurve && speedSpaceSettings.altitude) {
      drawCurve(
        chartLocal,
        'speed slopes',
        dataSimulation.slopesCurve,
        'speedSpaceChart',
        'curveLinear',
        CHART_AXES.SPACE_HEIGHT,
        'slopes'
      );
    }
    if (dataSimulation.slopesHistogram && speedSpaceSettings.slopes) {
      drawCurve(
        chartLocal,
        'speed slopesHistogram',
        dataSimulation.slopesHistogram,
        'speedSpaceChart',
        'curveMonotoneX',
        CHART_AXES.SPACE_GRADIENT,
        'slopesHistogram'
      );
      drawArea(
        chartLocal,
        'area slopes',
        dataSimulation.areaSlopesHistogram,
        'speedSpaceChart',
        'curveMonotoneX'
      );
    }
    if (dataSimulation.curvesHistogram && speedSpaceSettings.curves) {
      drawCurve(
        chartLocal,
        'speed curvesHistogram',
        dataSimulation.curvesHistogram,
        'speedSpaceChart',
        'curveLinear',
        CHART_AXES.SPACE_RADIUS,
        'curvesHistogram'
      );
    }

    const { electrificationRanges, powerRestrictionRanges } = dataSimulation;
    if (!isEmpty(electrificationRanges) && speedSpaceSettings.electricalProfiles) {
      electrificationRanges.forEach((source, index) => {
        if (source.electrificationUsage) {
          const segment = createProfileSegment(electrificationRanges, source);
          drawElectricalProfile(
            chartLocal,
            `electricalProfiles_${index}`,
            segment,
            'speedSpaceChart',
            ['position', 'height'],
            segment.isStriped,
            segment.isIncompatibleElectricalProfile,
            `electricalProfiles_${index}`
          );
        }
      });
    }
    if (!isEmpty(powerRestrictionRanges) && speedSpaceSettings.powerRestriction) {
      const restrictionSegments = [];
      let currentRestrictionSegment = createPowerRestrictionSegment(
        powerRestrictionRanges,
        powerRestrictionRanges[0]
      );
      powerRestrictionRanges.forEach((powerRestrictionRange, index) => {
        if (index === 0) return;
        if (
          powerRestrictionRange.code === currentRestrictionSegment.seenRestriction &&
          powerRestrictionRange.handled === currentRestrictionSegment.usedRestriction
        ) {
          const powerRestrictionRangeLength =
            powerRestrictionRange.stop - powerRestrictionRange.start;
          currentRestrictionSegment.position_middle += powerRestrictionRangeLength / 2;
          currentRestrictionSegment.position_end += powerRestrictionRangeLength;
        } else {
          restrictionSegments.push(currentRestrictionSegment);
          currentRestrictionSegment = createPowerRestrictionSegment(
            powerRestrictionRanges,
            powerRestrictionRange
          );
        }
      });
      restrictionSegments.push(currentRestrictionSegment);

      restrictionSegments.forEach((source, index) => {
        drawPowerRestriction(
          chartLocal,
          `powerRestrictions_${index}`,
          source,
          'speedSpaceChart',
          DRAWING_KEYS,
          source.isStriped,
          source.isIncompatiblePowerRestriction,
          source.isRestriction,
          `powerRestrictions_${index}`,
          speedSpaceSettings.electricalProfiles
        );
      });
    }
  }
}

export { drawTrain, createChart };
