import React from 'react';
import * as d3 from 'd3';
import { getDirection } from 'applications/osrd/components/Helpers/ChartHelpers';
import {
  updateContextMenu, updateMustRedraw, updateSelectedTrain,
} from 'reducers/osrdsimulation';
import drawCurve from 'applications/osrd/components/Simulation/drawCurve';
import drawArea from 'applications/osrd/components/Simulation/drawArea';
import drawText from 'applications/osrd/components/Simulation/drawText';

export default function drawTrain(
  chart, dispatch, dataSimulation, isPathSelected, isSelected, keyValues, marginsSettings,
  offsetTimeByDragging, rotate, setDragEnding, setDragOffset,
) {
  const groupID = `spaceTime-${dataSimulation.trainNumber}`;

  const initialDrag = rotate
    ? chart.y.invert(0)
    : chart.x.invert(0);
  let dragValue = 0;

  const dragTimeOffset = () => {
    dragValue += rotate ? d3.event.dy : d3.event.dx;
    const translation = rotate ? `0,${dragValue}` : `${dragValue},0`;
    d3.select(`#${groupID}`)
      .attr('transform', `translate(${translation})`);
    const value = rotate
      ? Math.floor((chart.y.invert(d3.event.dy) - initialDrag) / 1000)
      : Math.floor((chart.x.invert(d3.event.dx) - initialDrag) / 1000);
    setDragOffset(value);
  };

  const drag = d3.drag()
    .on('end', () => {
      setDragEnding(true);
      dispatch(updateMustRedraw(true));
    })
    .on('start', () => {
      dispatch(updateSelectedTrain(dataSimulation.trainNumber));
    })
    .on('drag', () => {
      dragTimeOffset();
    });

  chart.drawZone.append('g')
    .attr('id', groupID)
    .attr('class', 'chartTrain')
    .call(drag)
    .on('contextmenu', () => {
      d3.event.preventDefault();
      dispatch(updateContextMenu({
        id: dataSimulation.id, xPos: d3.event.layerX, yPos: d3.event.layerY,
      }));
      dispatch(updateSelectedTrain(dataSimulation.trainNumber));
      dispatch(updateMustRedraw(true));
    });

  // Test direction to avoid displaying block
  const direction = getDirection(dataSimulation.headPosition);

  if (direction) {
    if (marginsSettings[dataSimulation.id].baseBlocks
      || (!dataSimulation.margins_routeBeginOccupancy && !dataSimulation.eco_routeBeginOccupancy)) {
      drawArea(
        chart, `${isSelected && 'selected'} area`, dataSimulation.areaBlock,
        groupID, 'curveStepAfter', keyValues, rotate,
      );
      drawCurve(chart, `${isSelected && 'selected'} end-block`, dataSimulation.routeEndOccupancy, groupID,
        'curveLinear', keyValues, 'routeEndOccupancy', rotate, isSelected);
      drawCurve(chart, `${isSelected && 'selected'} start-block`, dataSimulation.routeBeginOccupancy, groupID,
        'curveLinear', keyValues, 'routeBeginOccupancy', rotate, isSelected);
    }
    if (dataSimulation.margins_routeEndOccupancy
      && marginsSettings[dataSimulation.id].marginsBlocks) {
      drawArea(
        chart, `${isSelected && 'selected'} area margins`, dataSimulation.margins_areaBlock,
        groupID, 'curveStepAfter', keyValues, rotate,
      );
      drawCurve(chart, `${isSelected && 'selected'} end-block`, dataSimulation.margins_routeEndOccupancy, groupID,
        'curveLinear', keyValues, 'margins_routeEndOccupancy', rotate, isSelected);
      drawCurve(chart, `${isSelected && 'selected'} start-block`, dataSimulation.margins_routeBeginOccupancy, groupID,
        'curveLinear', keyValues, 'margins_routeBeginOccupancy', rotate, isSelected);
    }
    if (dataSimulation.eco_routeEndOccupancy
      && marginsSettings[dataSimulation.id].ecoBlocks) {
      drawArea(
        chart, `${isSelected && 'selected'} area eco`, dataSimulation.eco_areaBlock,
        groupID, 'curveStepAfter', keyValues, rotate,
      );
      drawCurve(chart, `${isSelected && 'selected'} end-block`, dataSimulation.eco_routeEndOccupancy, groupID,
        'curveLinear', keyValues, 'eco_routeEndOccupancy', rotate, isSelected);
      drawCurve(chart, `${isSelected && 'selected'} start-block`, dataSimulation.eco_routeBeginOccupancy, groupID,
        'curveLinear', keyValues, 'eco_routeBeginOccupancy', rotate, isSelected);
    }
  }

  if (marginsSettings[dataSimulation.id].base) {
    dataSimulation.tailPosition.forEach((tailPositionSection) => drawCurve(
      chart, `${isSelected && 'selected'} tail`, tailPositionSection, groupID,
      'curveLinear', keyValues, 'tailPosition', rotate, isSelected,
    ));
    dataSimulation.headPosition.forEach((headPositionSection) => drawCurve(
      chart, `${isSelected && 'selected'} head`, headPositionSection, groupID,
      'curveLinear', keyValues, 'headPosition', rotate, isSelected,
    ));
  }

  if (dataSimulation.margins_headPosition && marginsSettings[dataSimulation.id].margins) {
    dataSimulation.margins_headPosition.forEach((tailPositionSection) => drawCurve(
      chart, `${isSelected && 'selected'} head margins`, tailPositionSection, groupID,
      'curveLinear', keyValues, 'margins_headPosition', rotate, isSelected,
    ));
  }
  if (dataSimulation.eco_headPosition && marginsSettings[dataSimulation.id].eco) {
    dataSimulation.eco_headPosition.forEach((tailPositionSection) => drawCurve(
      chart, `${isSelected && 'selected'} head eco`, tailPositionSection, groupID,
      'curveLinear', keyValues, 'eco_headPosition', rotate, isSelected,
    ));
  }
  drawText(
    chart, direction, groupID, isSelected,
    `${isPathSelected ? '🎢' : ''} ${dataSimulation.name}`, // text
    dataSimulation.headPosition[0][0].time, // x
    dataSimulation.headPosition[0][0].position, // y
  );
}
