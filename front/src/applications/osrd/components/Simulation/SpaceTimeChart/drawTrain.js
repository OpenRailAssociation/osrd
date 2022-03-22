import * as d3 from 'd3';

import { getDirection, timeShiftTrain } from 'applications/osrd/components/Helpers/ChartHelpers';
import { updateContextMenu, updateMustRedraw, updateSelectedTrain, updateSimulation, } from 'reducers/osrdsimulation';

import React from 'react';
import drawArea from 'applications/osrd/components/Simulation/drawArea';
import drawCurve from 'applications/osrd/components/Simulation/drawCurve';
import drawText from 'applications/osrd/components/Simulation/drawText';

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
  simulation
) {

  console.log("DRAWTRAINS", allowancesSettings)

  const groupID = `spaceTime-${dataSimulation.trainNumber}`;

  const initialDrag = rotate ? chart.y.invert(0) : chart.x.invert(0);
  let dragValue = 0;

  let dragFullOffset = 0;
  /**
   * Compute, in sceonds, the offset to drill down to the parent through setDragOffset passed hook
   *
   */
  const dragTimeOffset = (offset) => {
    const value = rotate
      ? Math.floor((chart.y.invert(offset) - initialDrag) / 1000)
      : Math.floor((chart.x.invert(offset) - initialDrag) / 1000);
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

  const drag = d3
    .drag()
    .on('end', () => {
      setDragEnding(true);
      dispatch(updateMustRedraw(true));
    })
    .on('start', () => {
      dragFullOffset = 0
      dispatch(updateSelectedTrain(dataSimulation.trainNumber));
    })
    .on('drag', () => {
      const dragSingleOffset = rotate ? d3.event.dy : d3.event.dx;
      dragFullOffset += rotate ? d3.event.dy : d3.event.dx;
      dragTimeOffset(dragSingleOffset, true);
      applyTrainCurveTranslation(dragFullOffset);
    });

  chart.drawZone
    .append('g')
    .attr('id', groupID)
    .attr('class', 'chartTrain')
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

  if (direction) {
    if (
      allowancesSettings[dataSimulation.id].baseBlocks ||
      !dataSimulation.eco_routeBeginOccupancy
    ) {
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
      );
    }
    if (dataSimulation.eco_routeEndOccupancy && allowancesSettings[dataSimulation.id].ecoBlocks) {
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
    }
  }

  if (allowancesSettings[dataSimulation.id].base) {
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

  if (dataSimulation.allowances_headPosition && allowancesSettings[dataSimulation.id].allowances) {
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
  if (dataSimulation.eco_headPosition && allowancesSettings[dataSimulation.id].eco) {
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
    dataSimulation.headPosition[0][0].time, // x
    dataSimulation.headPosition[0][0].position // y
  );
}
