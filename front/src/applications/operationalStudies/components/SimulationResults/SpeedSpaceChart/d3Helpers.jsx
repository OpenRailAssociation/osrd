import drawArea from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/drawArea';
import drawCurve from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/drawCurve';
import defineChart from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/defineChart';
import { defineLinear } from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/ChartHelpers';
import * as d3 from 'd3';
import { createProfileSegment } from 'applications/operationalStudies/consts';
import drawElectricalProfile from '../ChartHelpers/drawElectricalProfile';
import { POSITION, SPEED, SPEED_SPACE_CHART_KEY_VALUES } from '../simulationResultsConsts';

function createChart(
  CHART_ID,
  chart,
  resetChart,
  trainSimulation,
  rotate,
  heightOfSpeedSpaceChart,
  ref,
  setResetChart
) {
  d3.select(`#${CHART_ID}`).remove();
  const scaleX =
    chart === undefined || resetChart
      ? defineLinear(
          d3.max(trainSimulation.speed, (speedObject) => speedObject[rotate ? SPEED : POSITION]) +
            100
        )
      : chart.x;
  const scaleY =
    chart === undefined || resetChart
      ? defineLinear(
          d3.max(trainSimulation.speed, (speedObject) => speedObject[rotate ? POSITION : SPEED]) +
            50
        )
      : chart.y;

  const width =
    d3.select(`#container-${CHART_ID}`) !== null
      ? parseInt(d3.select(`#container-${CHART_ID}`)?.style('width'), 10)
      : 250;

  setResetChart(false);
  return defineChart(
    width,
    heightOfSpeedSpaceChart,
    scaleX,
    scaleY,
    ref,
    rotate,
    SPEED_SPACE_CHART_KEY_VALUES,
    CHART_ID
  );
}

function drawAxisTitle(chart, rotate) {
  chart.drawZone
    .append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('transform', rotate ? 'rotate(0)' : 'rotate(-90)')
    .attr('x', rotate ? chart.width - 10 : -10)
    .attr('y', rotate ? chart.height - 10 : 20)
    .text('KM/H');

  chart.drawZone
    .append('text')
    .attr('class', 'axis-unit')
    .attr('text-anchor', 'end')
    .attr('transform', rotate ? 'rotate(-90)' : 'rotate(0)')
    .attr('x', rotate ? -10 : chart.width - 10)
    .attr('y', rotate ? 20 : chart.height - 10)
    .text('M');
}

function drawTrain(dataSimulation, rotate, speedSpaceSettings, chart) {
  if (chart) {
    const chartLocal = chart;
    chartLocal.drawZone.select('g').remove();
    chartLocal.drawZone.append('g').attr('id', 'speedSpaceChart').attr('class', 'chartTrain');
    drawAxisTitle(chartLocal, rotate);

    drawArea(
      chartLocal,
      'area speed',
      dataSimulation.areaBlock,
      'speedSpaceChart',
      'curveLinear',
      SPEED_SPACE_CHART_KEY_VALUES,
      rotate
    );

    drawCurve(
      chartLocal,
      'speed',
      dataSimulation.speed,
      'speedSpaceChart',
      'curveLinear',
      SPEED_SPACE_CHART_KEY_VALUES,
      'speed',
      rotate
    );
    if (dataSimulation.margins_speed) {
      drawCurve(
        chartLocal,
        'speed margins',
        dataSimulation.margins_speed,
        'speedSpaceChart',
        'curveLinear',
        SPEED_SPACE_CHART_KEY_VALUES,
        'margins_speed',
        rotate
      );
    }
    if (dataSimulation.eco_speed) {
      drawCurve(
        chartLocal,
        'speed eco',
        dataSimulation.eco_speed,
        'speedSpaceChart',
        'curveLinear',
        SPEED_SPACE_CHART_KEY_VALUES,
        'eco_speed',
        rotate
      );
    }
    if (dataSimulation.vmax && speedSpaceSettings.maxSpeed) {
      drawCurve(
        chartLocal,
        'speed vmax',
        dataSimulation.vmax,
        'speedSpaceChart',
        'curveLinear',
        SPEED_SPACE_CHART_KEY_VALUES,
        'vmax',
        rotate
      );
    }
    if (dataSimulation.slopesCurve && speedSpaceSettings.altitude) {
      drawCurve(
        chartLocal,
        'speed slopes',
        dataSimulation.slopesCurve,
        'speedSpaceChart',
        'curveLinear',
        ['position', 'height'],
        'slopes',
        rotate
      );
    }
    if (dataSimulation.slopesHistogram && speedSpaceSettings.slopes) {
      drawCurve(
        chartLocal,
        'speed slopesHistogram',
        dataSimulation.slopesHistogram,
        'speedSpaceChart',
        'curveMonotoneX',
        ['position', 'gradient'],
        'slopesHistogram',
        rotate
      );
      drawArea(
        chartLocal,
        'area slopes',
        dataSimulation.areaSlopesHistogram,
        'speedSpaceChart',
        'curveMonotoneX',
        ['position', 'gradient'],
        rotate
      );
    }
    if (dataSimulation.curvesHistogram && speedSpaceSettings.curves) {
      drawCurve(
        chartLocal,
        'speed curvesHistogram',
        dataSimulation.curvesHistogram,
        'speedSpaceChart',
        'curveLinear',
        ['position', 'radius'],
        'curvesHistogram',
        rotate
      );
    }
    if (dataSimulation.modesAndProfiles && speedSpaceSettings.electricalProfiles) {
      dataSimulation.modesAndProfiles.forEach((source, index) => {
        const segment = createProfileSegment(dataSimulation.modesAndProfiles, source);

        drawElectricalProfile(
          chartLocal,
          `electricalProfiles_${index}`,
          segment,
          'speedSpaceChart',
          'curveLinear',
          ['position', 'height'],
          'electrical_profiles',
          rotate,
          segment.isStriped,
          segment.isIncompatible,
          `electricalProfiles_${index}`
        );
      });
    }
  }
}

export { drawTrain, createChart };
