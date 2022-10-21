import * as d3 from 'd3';

import { getDirection } from 'applications/customget/components/ChartHelpers';

import drawCurve from 'applications/customget/components/drawCurve';
import drawText from 'applications/customget/components/drawText';
import {
  departureArrivalTimes,
  updateDepartureArrivalTimes,
  updateContextMenu,
  updateMustRedraw,
  updateSelectedTrain
} from 'reducers/osrdsimulation';

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
      dataSimulation.headPosition[0][0].position,
    dataSimulation.color // y
  );
}
