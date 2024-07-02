import * as d3 from 'd3';
import { drag as d3drag, type DragContainerElement } from 'd3-drag';

import { getDirection } from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import drawCurve from 'modules/simulationResult/components/ChartHelpers/drawCurve';
import drawRect from 'modules/simulationResult/components/ChartHelpers/drawRect';
import drawText from 'modules/simulationResult/components/ChartHelpers/drawText';
import { CHART_AXES } from 'modules/simulationResult/consts';
import type { AllowancesSettings, Chart, SimulationTrain } from 'reducers/osrdsimulation/types';

// TODO DROP V1: readapt this function for v2 by removing everything related to base, eco
// or allowances as there will be only one type of data to display
export default function drawTrain(
  chart: Chart,
  dispatchUpdateSelectedTrainId: (selectedTrainId: number) => void,
  isPathSelected: boolean,
  isSelected: boolean,
  rotate: boolean,
  setDragOffset: React.Dispatch<React.SetStateAction<number>>,
  trainToDraw: SimulationTrain,
  allowancesSettings?: AllowancesSettings
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

  const drag = d3drag()
    .container((d) => d as DragContainerElement) // the component is dragged from its initial position
    .on('end', () => {
      dragTimeOffset(dragFullOffset);
    })
    .on('start', () => {
      dragFullOffset = 0;
      dispatchUpdateSelectedTrainId(trainToDraw.id);
    })
    .on('drag', (event) => {
      dragFullOffset += rotate ? event.dy : event.dx;
      applyTrainCurveTranslation(dragFullOffset);
    });

  const dragSelectionAppliance = (selection: d3.Selection<Element, unknown, null, undefined>) => {
    selection.attr('id', groupID).attr('class', 'chartTrain').call(drag);
  };

  chart.drawZone.append<Element>('g').call(dragSelectionAppliance);

  // Test direction to avoid displaying block
  const direction = getDirection(trainToDraw.headPosition);
  const currentAllowanceSettings = allowancesSettings
    ? allowancesSettings[trainToDraw.id]
    : undefined;
  if (direction) {
    const routeAspects = trainToDraw.eco_routeAspects ?? trainToDraw.routeAspects;
    routeAspects.forEach((routeAspect, index) => {
      drawRect(
        chart,
        `${isSelected && 'selected'} route-aspect`,
        routeAspect,
        groupID,
        rotate,
        `${groupID}_${routeAspect.signal_id}_${index}`
      );
    });
  }

  if (currentAllowanceSettings?.base) {
    trainToDraw.headPosition.forEach((headPositionSection) =>
      drawCurve(
        chart,
        `${isSelected && 'selected'} head`,
        headPositionSection,
        groupID,
        'curveLinear',
        CHART_AXES.SPACE_TIME,
        'headPosition',
        rotate,
        isSelected
      )
    );
    trainToDraw.tailPosition.forEach((tailPositionSection) =>
      drawCurve(
        chart,
        `${isSelected && 'selected'} tail`,
        tailPositionSection,
        groupID,
        'curveLinear',
        CHART_AXES.SPACE_TIME,
        'tailPosition',
        rotate,
        isSelected
      )
    );
  }

  if (currentAllowanceSettings?.eco) {
    if (trainToDraw.eco_headPosition) {
      trainToDraw.eco_headPosition.forEach((ecoHeadPosition) =>
        drawCurve(
          chart,
          `${isSelected && 'selected'} head eco`,
          ecoHeadPosition,
          groupID,
          'curveLinear',
          CHART_AXES.SPACE_TIME,
          'eco_headPosition',
          rotate,
          isSelected
        )
      );
    }
    if (trainToDraw.eco_tailPosition) {
      trainToDraw.eco_tailPosition.forEach((ecoTailPosition) =>
        drawCurve(
          chart,
          `${isSelected && 'selected'} head eco`,
          ecoTailPosition,
          groupID,
          'curveLinear',
          CHART_AXES.SPACE_TIME,
          'eco_headPosition',
          rotate,
          isSelected
        )
      );
    }
  }

  // TrainScheduleV2
  if (!currentAllowanceSettings) {
    trainToDraw.headPosition.forEach((headPositionSection) =>
      drawCurve(
        chart,
        `${isSelected && 'selected'} head`,
        headPositionSection,
        groupID,
        'curveLinear',
        CHART_AXES.SPACE_TIME,
        'eco_headPosition',
        rotate,
        isSelected
      )
    );
    trainToDraw.tailPosition.forEach((tailPositionSection) =>
      drawCurve(
        chart,
        `${isSelected && 'selected'} tail`,
        tailPositionSection,
        groupID,
        'curveLinear',
        CHART_AXES.SPACE_TIME,
        'eco_tailPosition',
        rotate,
        isSelected
      )
    );
  }

  const { headPosition } = trainToDraw;
  const firstHeadPos = headPosition.length && headPosition[0].length ? headPosition[0][0] : null;
  if (firstHeadPos && firstHeadPos.time != null) {
    drawText(
      chart,
      direction,
      groupID,
      isSelected,
      `${isPathSelected ? '🎢' : ''} ${trainToDraw.name}`, // text
      firstHeadPos.time, // x
      firstHeadPos.position // y
    );
  }
}
