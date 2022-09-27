import * as d3 from 'd3';

import { getDirection, timeShiftTrain } from 'applications/osrd/components/Helpers/ChartHelpers';
import {
  updateContextMenu,
  updateMustRedraw,
  updateSelectedTrain,
  updateSimulation,
} from 'reducers/osrdsimulation';

import React from 'react';
import drawArea from 'applications/osrd/components/Simulation/drawArea';
import drawCurve from 'applications/osrd/components/Simulation/drawCurve';
import drawRect from 'applications/osrd/components/Simulation/drawRect';
import drawText from 'applications/osrd/components/Simulation/drawText';
import {
  departureArrivalTimes,
  updateDepartureArrivalTimes,
} from '../../../../../reducers/osrdsimulation';

export default function drawTrain(
  chart,
  dispatch,
  dataSimulation,
  isPathSelected,
  isSelected,
  keyValues,
  allowancesSettings,
  offsetTimeByDragging,
  rotate,
  setDragEnding,
  setDragOffset,
  simulation,
  isStdcm
) {
  const groupID = `spaceTime-${dataSimulation.trainNumber}`;

  const initialDrag = rotate ? chart.y.invert(0) : chart.x.invert(0);

  let dragFullOffset = 0;

  const getDragOffsetValue = (offset) =>
    rotate
      ? Math.floor((chart.y.invert(offset) - initialDrag) / 1000)
      : Math.floor((chart.x.invert(offset) - initialDrag) / 1000);

  /**
   * Compute, in sceonds, the offset to drill down to the parent through setDragOffset passed hook
   *
   */
  const dragTimeOffset = (offset) => {
    const value = getDragOffsetValue(offset);
    setDragOffset(value);
  };

  /**
   * Apply a contextual translation on a viz group on the chart.
   * @todo pure it, pass chartID, rotate as params
   *
   * @param {int} offset
   */
  const applyTrainCurveTranslation = (offset) => {
    const translation = rotate ? `0,${offset}` : `${offset},0`;
    d3.select(`#${groupID}`).attr('transform', `translate(${translation})`);
  };
  let debounceTimeoutId;
  function debounceUpdateDepartureArrivalTimes(computedDepartureArrivalTimes, interval) {
    clearTimeout(debounceTimeoutId);
    debounceTimeoutId = setTimeout(() => {
      dispatch(updateDepartureArrivalTimes(computedDepartureArrivalTimes));
    }, interval);
  }

  const drag = d3
    .drag()
    .on('end', () => {
      dragTimeOffset(dragFullOffset, true);
      setDragEnding(true);
      dispatch(updateMustRedraw(true));
    })
    .on('start', () => {
      dragFullOffset = 0;
      dispatch(updateSelectedTrain(dataSimulation.trainNumber));
    })
    .on('drag', () => {
      dragFullOffset += rotate ? d3.event.dy : d3.event.dx;
      const value = getDragOffsetValue(dragFullOffset);
      const newDepartureArrivalTimes = departureArrivalTimes(simulation, value);
      debounceUpdateDepartureArrivalTimes(newDepartureArrivalTimes, 15);
      applyTrainCurveTranslation(dragFullOffset);
    });

  chart.drawZone
    .append('g')
    .attr('id', groupID)
    .attr('class', 'chartTrain')
    .attr('filter', () => (isStdcm ? `url(#stdcmFilter)` : null))
    .call(drag)
    .on('contextmenu', () => {
      d3.event.preventDefault();
      dispatch(
        updateContextMenu({
          id: dataSimulation.id,
          xPos: d3.event.layerX,
          yPos: d3.event.layerY,
        })
      );
      dispatch(updateSelectedTrain(dataSimulation.trainNumber));
      dispatch(updateMustRedraw(true));
    });

  // Test direction to avoid displaying block
  const direction = getDirection(dataSimulation.headPosition);
  const currentAllowanceSettings = allowancesSettings
    ? allowancesSettings[dataSimulation.id]
    : undefined;

  if (direction && currentAllowanceSettings) {
    if (currentAllowanceSettings?.baseBlocks || !dataSimulation.routeAspects) {
      /*
      dataSimulation.areaBlock.forEach((dataSimulationAreaBlockSection) =>
        drawArea(
          chart,
          `${isSelected && 'selected'} area`,
          dataSimulationAreaBlockSection,
          groupID,
          'curveStepAfter',
          keyValues,
          rotate
        )
      );
      */
      /*
      dataSimulation.routeEndOccupancy.forEach((routeEndOccupancySection) =>
        drawCurve(
          chart,
          `${isSelected && 'selected'} end-block`,
          routeEndOccupancySection,
          groupID,
          'curveLinear',
          keyValues,
          'routeEndOccupancy',
          rotate,
          isSelected
        )
      );
      dataSimulation.routeBeginOccupancy.forEach((routeBeginOccupancySection) =>
        drawCurve(
          chart,
          `${isSelected && 'selected'} start-block`,
          routeBeginOccupancySection,
          groupID,
          'curveLinear',
          keyValues,
          'routeBeginOccupancy',
          rotate,
          isSelected
        )

      )
      */


/*
      const routeAspectsClipPath = chart.drawZone
        .select(`#${groupID}`)
        .append('clipPath')
        .attr('id', `${groupID}routeAspectsClipPath`)
        .attr('maskUnits', 'userSpaceOnUse')
        .attr('filter', `url(#stdcmFilter)`)

      const routeAspectsMask = chart.drawZone
        .select(`#${groupID}`)
        .append('mask')
        .attr('id', `${groupID}routeAspectsMask`)
        .attr('maskUnits', 'userSpaceOnUse')
        .attr('filter', `url(#stdcmFilter)`)
        */
       /*

      dataSimulation.routeAspects.forEach((routeAspect) => {
        routeAspectsMask
          .append('use')
          .attr('href', `#${groupID}${routeAspect.route_id}${routeAspect.color}`)
          .attr('stroke-width', 15)
          .attr('fill', 'none')
          .attr('stroke', '#fff')
          .attr('stroke-linejoin', 'round')

      });
      */
/*
      dataSimulation.routeAspects.forEach((routeAspect) => {
        routeAspectsClipPath
          .append('use')
          .attr('href', `#${groupID}${routeAspect.route_id}${routeAspect.color}`)
          .attr('stroke-width', 10)
          .attr('stroke', '#000')

      });
*/
/*
      chart.drawZone
        .select(`#${groupID}`)
        .append('rect')
        .attr('class', `${isStdcm && 'stdcm'} routeAspectsClamp`)
        .attr('width', '100%')
        .attr('height', '100%')
        */
    }


     // Let's draw route_aspects
     dataSimulation.routeAspects.forEach((routeAspect) => {

      drawRect(
        chart,
        `${isSelected && 'selected'} route-aspect`,
        routeAspect,
        groupID,
        'curveLinear',
        keyValues,
        'eco_routeEndOccupancy',
        rotate,
        isSelected,
        `${groupID}${routeAspect.route_id}${routeAspect.color}`
      );
    });


    if (dataSimulation.eco_routeAspects && currentAllowanceSettings?.ecoBlocks) {
      /*
      dataSimulation.eco_areaBlock.forEach((dataSimulationEcoAreaBlockSection) =>
        drawArea(
          chart,
          `${isSelected && 'selected'} area eco`,
          dataSimulationEcoAreaBlockSection,
          groupID,
          'curveStepAfter',
          keyValues,
          rotate
        )
      );
      */

      // Let's draw route_aspects
      dataSimulation.eco_routeAspects.forEach((ecoRouteAspect) => {
        drawRect(
          chart,
          `${isSelected && 'selected'} route-aspect`,
          ecoRouteAspect,
          groupID,
          'curveLinear',
          keyValues,
          'eco_routeEndOccupancy',
          rotate,
          isSelected
        );
      });
      /*
      dataSimulation.eco_routeEndOccupancy.forEach((ecoRouteEndOccupancySection) =>
        drawCurve(
          chart,
          `${isSelected && 'selected'} end-block`,
          ecoRouteEndOccupancySection,
          groupID,
          'curveLinear',
          keyValues,
          'eco_routeEndOccupancy',
          rotate,
          isSelected
        )
      );
      dataSimulation.eco_routeBeginOccupancy.forEach((ecoRouteBeginOccupancySection) =>
        drawCurve(
          chart,
          `${isSelected && 'selected'} start-block`,
          ecoRouteBeginOccupancySection,
          groupID,
          'curveLinear',
          keyValues,
          'eco_routeBeginOccupancy',
          rotate,
          isSelected
        )
      );
      */
    }
  }

  if (currentAllowanceSettings?.base) {
    dataSimulation.tailPosition.forEach((tailPositionSection) =>
      drawCurve(
        chart,
        `${isSelected && 'selected'} tail`,
        tailPositionSection,
        groupID,
        'curveLinear',
        keyValues,
        'tailPosition',
        rotate,
        isSelected
      )
    );
    dataSimulation.headPosition.forEach((headPositionSection) =>
      drawCurve(
        chart,
        `${isSelected && 'selected'} head`,
        headPositionSection,
        groupID,
        'curveLinear',
        keyValues,
        'headPosition',
        rotate,
        isSelected
      )
    );
  }

  if (dataSimulation.allowances_headPosition && currentAllowanceSettings?.allowances) {
    dataSimulation.allowances_headPosition.forEach((tailPositionSection) =>
      drawCurve(
        chart,
        `${isSelected && 'selected'} head allowances`,
        tailPositionSection,
        groupID,
        'curveLinear',
        keyValues,
        'allowances_headPosition',
        rotate,
        isSelected
      )
    );
  }
  if (currentAllowanceSettings?.eco && dataSimulation.eco_headPosition) {
    dataSimulation.eco_headPosition.forEach((tailPositionSection) =>
      drawCurve(
        chart,
        `${isSelected && 'selected'} head eco`,
        tailPositionSection,
        groupID,
        'curveLinear',
        keyValues,
        'eco_headPosition',
        rotate,
        isSelected
      )
    );
  }
  drawText(
    chart,
    direction,
    groupID,
    isSelected,
    `${isPathSelected ? '🎢' : ''} ${dataSimulation.name}`, // text
    dataSimulation.headPosition[0] &&
      dataSimulation.headPosition[0][0] &&
      dataSimulation.headPosition[0][0].time, // x
    dataSimulation.headPosition[0] &&
      dataSimulation.headPosition[0][0] &&
      dataSimulation.headPosition[0][0].position // y
  );
}
