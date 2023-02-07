import * as d3 from 'd3';
import { drag as d3drag } from 'd3-drag';

import {
  getDirection,
  offsetSeconds,
} from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/ChartHelpers';
import drawCurve from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/drawCurve';
import drawRect from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/drawRect';
import drawText from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/drawText';
import {
  updateContextMenu,
  updateMustRedraw,
  updateSelectedTrain,
  updateDepartureArrivalTimes,
} from 'reducers/osrdsimulation/actions';

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
  isStdcm,
  setSelectedTrain
) {
  const groupID = `spaceTime-${dataSimulation.trainNumber}`;

  const initialDrag = rotate ? chart.y.invert(0) : chart.x.invert(0);

  let dragFullOffset = 0;

  const getDragOffsetValue = (offset) =>
    rotate
      ? Math.floor((chart.y.invert(offset) - initialDrag) / 1000)
      : Math.floor((chart.x.invert(offset) - initialDrag) / 1000);

  /** Compute, in seconds, the offset to drill down to the parent through setDragOffset passed hook */
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

  const makeDepartureArrivalTimes = (dragOffset, selectedTrainId) =>
    simulation.trains.map((train) => ({
      id: train.id,
      labels: train.labels,
      name: train.name,
      path: train.path,
      departure:
        selectedTrainId !== undefined && selectedTrainId === train.id
          ? offsetSeconds(train.base.stops[0].time + dragOffset)
          : train.base.stops[0].time,
      arrival:
        selectedTrainId !== undefined && selectedTrainId === train.id
          ? offsetSeconds(train.base.stops[train.base.stops.length - 1].time + dragOffset)
          : train.base.stops[train.base.stops.length - 1].time,
      speed_limit_composition: train.speed_limit_composition,
    }));

  const drag = d3drag()
    .container((d) => d) // the component is dragged from its initial position
    .on('end', () => {
      dragTimeOffset(dragFullOffset, true);
      setDragEnding(true);
      dispatch(updateMustRedraw(true));
    })
    .on('start', () => {
      dragFullOffset = 0;
      setSelectedTrain(dataSimulation.trainNumber);
      dispatch(updateSelectedTrain(dataSimulation.trainNumber));
    })
    .on('drag', (event) => {
      dragFullOffset += rotate ? event.dy : event.dx;
      const value = getDragOffsetValue(dragFullOffset);
      const newDepartureArrivalTimes = makeDepartureArrivalTimes(value, dataSimulation.id);
      debounceUpdateDepartureArrivalTimes(newDepartureArrivalTimes, 15);
      applyTrainCurveTranslation(dragFullOffset);
    });

  chart.drawZone
    .append('g')
    .attr('id', groupID)
    .attr('class', 'chartTrain')
    .attr('filter', () => (isStdcm ? `url(#stdcmFilter)` : null))
    .call(drag)
    .on('contextmenu', (event) => {
      event.preventDefault();
      dispatch(
        updateContextMenu({
          id: dataSimulation.id,
          xPos: event.layerX,
          yPos: event.layerY,
        })
      );
      setSelectedTrain(dataSimulation.trainNumber);
      dispatch(updateSelectedTrain(dataSimulation.trainNumber));
      dispatch(updateMustRedraw(true));
    });

  // Test direction to avoid displaying block
  const direction = getDirection(dataSimulation.headPosition);
  const currentAllowanceSettings = allowancesSettings
    ? allowancesSettings[dataSimulation.id]
    : undefined;

  if (direction && currentAllowanceSettings) {
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
      // Let's draw eco_route_aspects
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
