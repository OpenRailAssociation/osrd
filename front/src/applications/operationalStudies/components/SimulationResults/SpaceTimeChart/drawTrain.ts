import * as d3 from 'd3';
import { drag as d3drag, DragContainerElement } from 'd3-drag';

import {
  getDirection,
  makeTrainList,
} from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/ChartHelpers';
import drawCurve from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/drawCurve';
import drawRect from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/drawRect';
import drawText from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/drawText';
import {
  AllowancesSettings,
  Chart,
  SimulationTrain,
  Train,
  TrainsWithArrivalAndDepartureTimes,
} from 'reducers/osrdsimulation/types';

export default function drawTrain(
  allowancesSettings: AllowancesSettings,
  chart: Chart,
  dispatchUpdateDepartureArrivalTimes: (
    departureArrivalTimes: TrainsWithArrivalAndDepartureTimes[]
  ) => void,
  dispatchUpdateMustRedraw: (mustRedraw: boolean) => void,
  dispatchUpdateSelectedTrainId: (selectedTrainId: number) => void,
  isPathSelected: boolean,
  isSelected: boolean,
  keyValues: ['time', 'position'],
  rotate: boolean,
  setDragOffset: React.Dispatch<React.SetStateAction<number>>,
  trainSimulations: Train[],
  trainToDraw: SimulationTrain
) {
  const groupID = `spaceTime-${trainToDraw.id}`;

  let dragFullOffset = 0;

  const getDragOffsetValue = (offset: number): number => {
    const initialDrag = Number(rotate ? chart.y.invert(0) : chart.x.invert(0));
    return rotate
      ? Math.floor((Number(chart.y.invert(offset)) - initialDrag) / 1000)
      : Math.floor((Number(chart.x.invert(offset)) - initialDrag) / 1000);
  };

  /** Compute, in seconds, the offset to drill down to the parent through setDragOffset passed hook */
  const dragTimeOffset = (offset: number) => {
    const value = getDragOffsetValue(offset);
    setDragOffset(value);
  };

  /**
   * Apply a contextual translation on a viz group on the chart.
   * @todo pure it, pass chartID, rotate as params
   *
   * @param {int} offset
   */
  const applyTrainCurveTranslation = (offset: number) => {
    const translation = rotate ? `0,${offset}` : `${offset},0`;
    d3.select(`#${groupID}`).attr('transform', `translate(${translation})`);
    const releventLine = rotate ? '#horizontal-line' : '#vertical-line';
    d3.select(releventLine).attr('transform', `translate(${translation})`);
  };

  let debounceTimeoutId: number;

  function debounceUpdateDepartureArrivalTimes(
    computedDepartureArrivalTimes: TrainsWithArrivalAndDepartureTimes[],
    interval: number
  ) {
    clearTimeout(debounceTimeoutId);
    debounceTimeoutId = window.setTimeout(() => {
      dispatchUpdateDepartureArrivalTimes(computedDepartureArrivalTimes);
    }, interval);
  }

  const drag = d3drag()
    .container((d) => d as DragContainerElement) // the component is dragged from its initial position
    .on('end', () => {
      dragTimeOffset(dragFullOffset);
      dispatchUpdateMustRedraw(true);
    })
    .on('start', () => {
      dragFullOffset = 0;
      dispatchUpdateSelectedTrainId(trainToDraw.id);
    })
    .on('drag', (event) => {
      dragFullOffset += rotate ? event.dy : event.dx;
      const offset = getDragOffsetValue(dragFullOffset);
      const newDepartureArrivalTimes = makeTrainList(trainSimulations, trainToDraw.id, offset);
      debounceUpdateDepartureArrivalTimes(newDepartureArrivalTimes, 15);
      applyTrainCurveTranslation(dragFullOffset);
    });

  const dragSelectionAppliance = (selection: d3.Selection<Element, unknown, null, undefined>) => {
    selection
      .attr('id', groupID)
      .attr('class', 'chartTrain')
      .attr('filter', () => (trainToDraw?.isStdcm ? `url(#stdcmFilter)` : null))
      .call(drag);
  };

  chart.drawZone.append<Element>('g').call(dragSelectionAppliance);

  // Test direction to avoid displaying block
  const direction = getDirection(trainToDraw.headPosition);
  const currentAllowanceSettings = allowancesSettings
    ? allowancesSettings[trainToDraw.id]
    : undefined;

  if (direction && currentAllowanceSettings) {
    if (trainToDraw.eco_routeAspects && currentAllowanceSettings?.ecoBlocks) {
      // Let's draw eco_route_aspects
      trainToDraw.eco_routeAspects.forEach((ecoRouteAspect) => {
        drawRect(
          chart,
          `${isSelected && 'selected'} route-aspect`,
          ecoRouteAspect,
          groupID,
          rotate
        );
      });
    } else {
      // Let's draw normal route_aspects
      trainToDraw.routeAspects.forEach((routeAspect) => {
        drawRect(
          chart,
          `${isSelected && 'selected'} route-aspect`,
          routeAspect,
          groupID,
          rotate,
          `${groupID}${routeAspect.route_id}${routeAspect.color}`
        );
      });
    }
  }

  if (currentAllowanceSettings?.base) {
    trainToDraw.tailPosition.forEach((tailPositionSection) =>
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
    trainToDraw.headPosition.forEach((headPositionSection) =>
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

  if (currentAllowanceSettings?.eco && trainToDraw.eco_headPosition) {
    trainToDraw.eco_headPosition.forEach((tailPositionSection) =>
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
  const trainToDrawHeadPos = trainToDraw.headPosition[0][0];
  if (trainToDrawHeadPos && trainToDrawHeadPos.time != null) {
    drawText(
      chart,
      direction,
      groupID,
      isSelected,
      `${isPathSelected ? '🎢' : ''} ${trainToDraw.name}`, // text
      trainToDrawHeadPos.time, // x
      trainToDrawHeadPos.position // y
    );
  }
}
