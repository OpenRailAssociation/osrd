import * as d3 from 'd3';

import { updateContextMenu, updateMustRedraw, updateSelectedTrain } from 'reducers/osrdsimulation';

import React from 'react';
import drawArea from 'applications/osrd/components/Simulation/drawArea';
import drawCurve from 'applications/osrd/components/Simulation/drawCurve';
import drawText from 'applications/osrd/components/Simulation/drawText';
import { getDirection } from 'applications/osrd/components/Helpers/ChartHelpers';

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
  setDragOffset
) {
  const groupID = `spaceTime-${dataSimulation.trainNumber}`;

  const initialDrag = rotate ? chart.y.invert(0) : chart.x.invert(0);
  let dragValue = 0;

  const dragTimeOffset = (unDrillValue = false) => {
    dragValue += rotate ? d3.event.dy : d3.event.dx;
    console.log('dragValue', dragValue);
    const translation = rotate ? `0,${dragValue}` : `${dragValue},0`;
    d3.select(`#${groupID}`).attr('transform', `translate(${translation})`);
    const value = rotate
      ? Math.floor((chart.y.invert(d3.event.dy) - initialDrag) / 1000)
      : Math.floor((chart.x.invert(d3.event.dx) - initialDrag) / 1000);
    console.log('value', value);
    if (unDrillValue) setDragOffset(value);
    setDragOffset(value);
  };

  const drag = d3
    .drag()
    .on('end', () => {
      dragTimeOffset(true);
      setDragEnding(true);
      dispatch(updateMustRedraw(true));
    })
    .on('start', () => {
      dispatch(updateSelectedTrain(dataSimulation.trainNumber));
    })
    .on('drag', () => {
      dragTimeOffset();
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
