import * as d3 from 'd3';
import { zoom as d3zoom } from 'd3-zoom';
import { pointer } from 'd3-selection';

import {
  gridX,
  gridY,
  interpolateOnPosition,
  interpolateOnTime,
  isGET,
} from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/ChartHelpers';
import {
  updateContextMenu,
  updateMustRedraw,
  updateTimePositionValues,
} from 'reducers/osrdsimulation/actions';
import { datetime2sec, sec2datetime } from 'utils/timeManipulation';
import {
  LIST_VALUES_NAME_SPACE_TIME,
  LIST_VALUES_NAME_SPEED_SPACE,
} from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import drawGuideLines from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/drawGuideLines';
import { store } from 'Store';

export const displayGuide = (chart, opacity) => {
  if (chart.svg) {
    chart.svg.selectAll('#vertical-line').style('opacity', opacity);
    chart.svg.selectAll('#horizontal-line').style('opacity', opacity);
    chart.svg.selectAll('.pointer').style('opacity', opacity);
  } else {
    console.warn('attempt to display guide with no whart.svg set, check order of impl.');
  }
};

export const updatePointers = (
  chart,
  keyValues,
  listValues,
  positionValues,
  rotate,
  doGuideLines = false
) => {
  listValues.forEach((name) => {
    if (positionValues[name]) {
      chart.svg
        .selectAll(`#pointer-${name}`)
        .attr(
          'cx',
          rotate
            ? chart.x(positionValues[name][keyValues[1]])
            : chart.x(positionValues[name][keyValues[0]])
        )
        .attr(
          'cy',
          rotate
            ? chart.y(positionValues[name][keyValues[0]])
            : chart.y(positionValues[name][keyValues[1]])
        );
    }
    if (doGuideLines) {
      chart.svg
        .selectAll('#vertical-line')
        .attr('x1', pointer(event, event.currentTarget)[0])
        .attr('x2', pointer(event, event.currentTarget)[0]);
      chart.svg
        .selectAll('#horizontal-line')
        .attr('y1', pointer(event, event.currentTarget)[1])
        .attr('y2', pointer(event, event.currentTarget)[1]);
    }
  });
};

const updateChart = (chart, keyValues, rotate, event) => {
  // recover the new scale & test if movement under 0

  let newX = chart.x;
  let newY = chart.y;
  if (
    (event.sourceEvent.shiftKey || event.sourceEvent.ctrlKey) &&
    !(event.sourceEvent.shiftKey && event.sourceEvent.ctrlKey)
  ) {
    newX = event.transform.rescaleX(chart.originalScaleX);
    newY = event.transform.rescaleY(chart.originalScaleY);
  } else if (event.sourceEvent.shiftKey && event.sourceEvent.ctrlKey) {
    if (rotate) {
      newY = event.transform.rescaleY(chart.originalScaleY);
    } else {
      newX = event.transform.rescaleX(chart.originalScaleX);
    }
  }

  // update axes with these new boundaries
  const axisBottomX =
    !rotate && isGET(keyValues)
      ? d3.axisBottom(newX).tickFormat(d3.timeFormat('%H:%M:%S'))
      : d3.axisBottom(newX);
  const axisLeftY =
    rotate && isGET(keyValues)
      ? d3.axisLeft(newY).tickFormat(d3.timeFormat('%H:%M:%S'))
      : d3.axisLeft(newY);
  chart.xAxis.call(axisBottomX);
  chart.yAxis.call(axisLeftY);

  chart.xAxisGrid.call(gridX(newX, chart.height));
  chart.yAxisGrid.call(gridY(newY, chart.width));

  // update lines & areas
  chart.drawZone.selectAll('.line').attr(
    'd',
    d3
      .line()
      .x((d) => newX(rotate ? d[keyValues[1]] : d[keyValues[0]]))
      .y((d) => newY(rotate ? d[keyValues[0]] : d[keyValues[1]]))
  );

  chart.drawZone
    .selectAll('rect.route-aspect')
    .attr('x', (d) => newX(rotate ? d[`${keyValues[1]}_start`] : d[`${keyValues[0]}_start`]))
    .attr(
      'y',
      (d) =>
        newY(rotate ? d[`${keyValues[0]}_start`] : d[`${keyValues[1]}_start`]) -
        (rotate
          ? newY(d[`${keyValues[0]}_end`]) - newY(d[`${keyValues[0]}_start`])
          : newY(d[`${keyValues[1]}_end`]) - newY(d[`${keyValues[1]}_start`])) *
          -1
    )
    .attr('width', (d) =>
      rotate
        ? newX(d[`${keyValues[1]}_end`]) - newX(d[`${keyValues[1]}_start`])
        : newX(d[`${keyValues[0]}_end`]) - newX(d[`${keyValues[0]}_start`])
    )
    .attr(
      'height',
      (d) =>
        (rotate
          ? newY(d[`${keyValues[0]}_end`]) - newY(d[`${keyValues[0]}_start`])
          : newY(d[`${keyValues[1]}_end`]) - newY(d[`${keyValues[1]}_start`])) * -1
    );

  chart.drawZone.selectAll('.area').attr(
    'd',
    rotate
      ? d3
          .area()
          .y((d) => newY(d[keyValues[0]]))
          .x0((d) => newX(d.value0))
          .x1((d) => newX(d.value1))
          .curve(isGET(keyValues) ? d3.curveStepAfter : d3.curveLinear)
      : d3
          .area()
          .x((d) => newX(d[keyValues[0]]))
          .y0((d) => newY(d.value0))
          .y1((d) => newY(d.value1))
          .curve(isGET(keyValues) ? d3.curveStepAfter : d3.curveLinear)
  );

  // OPERATIONNAL POINTS
  if (rotate) {
    chart.drawZone
      .selectAll('#get-operationalPointsZone .op-line')
      .attr('x1', (d) => newX(d))
      .attr('x2', (d) => newX(d));
    chart.drawZone.selectAll('#get-operationalPointsZone .op-text').attr('x', (d) => newX(d));
    chart.drawZone
      .selectAll('#gev-operationalPointsZone .op-line')
      .attr('y1', (d) => newY(d))
      .attr('y2', (d) => newY(d));
    chart.drawZone.selectAll('#gev-operationalPointsZone .op-text').attr('y', (d) => newY(d));
  } else {
    chart.drawZone
      .selectAll('#get-operationalPointsZone .op-line')
      .attr('y1', (d) => newY(d))
      .attr('y2', (d) => newY(d));
    chart.drawZone.selectAll('#get-operationalPointsZone .op-text').attr('y', (d) => newY(d));
    chart.drawZone
      .selectAll('#gev-operationalPointsZone .op-line')
      .attr('x1', (d) => newX(d))
      .attr('x2', (d) => newX(d));
    chart.drawZone.selectAll('#gev-operationalPointsZone .op-text').attr('x', (d) => newX(d));
  }

  chart.drawZone.selectAll('.curve-label').attr('transform', event.transform);

  chart.drawZone
    .selectAll('.conflictsPoints')
    .attr('cx', (d) => newX(rotate ? d[keyValues[1]] : d[keyValues[0]]))
    .attr('cy', (d) => newY(rotate ? d[keyValues[0]] : d[keyValues[1]]));
  return { newX, newY };
};

// Factorizes func to update VerticalLine on 3 charts: SpaceTime, SpeedSpaceChart, SpaceCurvesSlopes
export const traceVerticalLine = (
  chart,
  dataSimulation, // not used
  keyValues,
  listValues,
  positionValues,
  refValueName, // not used
  rotate,
  timePosition
) => {
  if (chart !== undefined) {
    displayGuide(chart, 1);
    if (rotate) {
      chart.svg
        .selectAll('#horizontal-line')
        .attr(
          'y1',
          chart.y(
            !isGET(keyValues) && positionValues.speed ? positionValues.speed.position : timePosition
          )
        )
        .attr(
          'y2',
          chart.y(
            !isGET(keyValues) && positionValues.speed ? positionValues.speed.position : timePosition
          )
        );
    } else {
      chart.svg
        .selectAll('#vertical-line')
        .attr(
          'x1',
          chart.x(
            !isGET(keyValues) && positionValues.speed ? positionValues.speed.position : timePosition
          )
        )
        .attr(
          'x2',
          chart.x(
            !isGET(keyValues) && positionValues.speed ? positionValues.speed.position : timePosition
          )
        );
    }

    updatePointers(chart, keyValues, listValues, positionValues, rotate);
  }
};

// enableInteractivity

// Override the default wheelDelta computation to get smoother zoom
function wheelDelta(event) {
  let factor = 1;
  if (event.deltaMode === 1) {
    factor = 0.005;
  } else if (event.deltaMode) {
    factor = 0.01;
  } else {
    factor = 0.002;
  }

  return -event.deltaY * factor;
}

// /!\ NOT ISOLATED FUNCTION
const enableInteractivity = (
  chart,
  dataSimulation, // GevPreparedData
  dispatch,
  keyValues,
  listValues,
  positionValues,
  rotate,
  setChart,
  _setYPosition,
  _setZoomLevel,
  _yPosition,
  _zoomLevel
) => {
  if (!chart) return;

  let newHoverPosition;

  const zoom = d3zoom(newHoverPosition)
    .scaleExtent([0.3, 20]) // This control how much you can unzoom (x0.5) and zoom (x20)
    .extent([
      [0, 0],
      [chart.width, chart.height],
    ])
    .wheelDelta(wheelDelta)
    .on('zoom', (event) => {
      event.sourceEvent.preventDefault();
      const zoomFunctions = updateChart(chart, keyValues, rotate, event);
      const newChart = { ...chart, x: zoomFunctions.newX, y: zoomFunctions.newY };
      setChart(newChart);
    })
    .filter(
      (event) => (event.button === 0 || event.button === 1) && (event.ctrlKey || event.shiftKey)
    )
    .on('start', () => {
      if (dispatch) dispatch(updateContextMenu(undefined));
    })
    .on('end', () => {
      if (dispatch) dispatch(updateMustRedraw(true));
    });

  let debounceTimeoutId;

  function debounceUpdateTimePositionValues(timePositionLocal, immediatePositionsValues, interval) {
    clearTimeout(debounceTimeoutId);
    debounceTimeoutId = setTimeout(() => {
      if (dispatch) dispatch(updateTimePositionValues(timePositionLocal, null));
    }, interval);
  }

  const mousemove = (event, _value) => {
    // If GET && not playing
    const { osrdsimulation } = store.getState();
    if (!osrdsimulation.isPlaying) {
      if (isGET(keyValues)) {
        // recover coordinate we need

        const timePositionLocal = rotate
          ? chart.y.invert(pointer(event, event.currentTarget)[1])
          : chart.x.invert(pointer(event, event.currentTarget)[0]);

        debounceUpdateTimePositionValues(timePositionLocal, null, 15);
        const immediatePositionsValuesForPointer = interpolateOnTime(
          dataSimulation,
          keyValues,
          LIST_VALUES_NAME_SPACE_TIME,
          timePositionLocal
        );
        updatePointers(chart, keyValues, listValues, immediatePositionsValuesForPointer, rotate);
        // useless: will be called by traceVerticalLine on positionValue useEffect
        //
      } else {
        // If GEV
        const positionLocal = rotate
          ? chart.y.invert(pointer(event, event.currentTarget)[1])
          : chart.x.invert(pointer(event, event.currentTarget)[0]);
        const timePositionLocal = interpolateOnPosition(dataSimulation, keyValues, positionLocal);
        const immediatePositionsValuesForPointer = interpolateOnTime(
          dataSimulation,
          keyValues,
          LIST_VALUES_NAME_SPEED_SPACE,
          datetime2sec(timePositionLocal)
        );

        // GEV prepareData func multiply speeds by 3.6. We need to normalize that to make a convenitn pointer update
        LIST_VALUES_NAME_SPEED_SPACE.forEach((name) => {
          if (
            immediatePositionsValuesForPointer[name] &&
            !Number.isNaN(immediatePositionsValuesForPointer[name]?.time) &&
            !Number.isNaN(immediatePositionsValuesForPointer[name]?.speed)
          ) {
            immediatePositionsValuesForPointer[name].speed /= 3.6;
            immediatePositionsValuesForPointer[name].time = sec2datetime(
              immediatePositionsValuesForPointer[name].time
            );
          }
        });

        updatePointers(chart, keyValues, listValues, immediatePositionsValuesForPointer, rotate);

        if (timePositionLocal) {
          debounceUpdateTimePositionValues(timePositionLocal, null, 15);
        }
      }

      // Update guideLines
      chart.svg
        .selectAll('#vertical-line')
        .attr('x1', pointer(event, event.currentTarget)[0])
        .attr('x2', pointer(event, event.currentTarget)[0]);
      chart.svg
        .selectAll('#horizontal-line')
        .attr('y1', pointer(event, event.currentTarget)[1])
        .attr('y2', pointer(event, event.currentTarget)[1]);
    }
  };

  chart.svg // .selectAll('.zoomable')
    .on('mouseover', () => displayGuide(chart, 1))
    .on('mousemove', mousemove)
    .on('wheel', (event) => {
      if (event.ctrlKey || event.shiftKey) {
        event.preventDefault();
      }
    })
    .call(zoom);

  drawGuideLines(chart);
};

// keyValues ['time', 'position'] or ['position', 'speed']
export const isolatedEnableInteractivity = (
  chart,
  selectedTrainData,
  keyValues,
  listValues,
  rotate,
  setChart,
  setLocalTime,
  setLocalPosition,
  setMousePos,
  simulationIsPlaying,
  dispatchUpdateMustRedraw,
  dispatchUpdateTimePositionValues
) => {
  if (!chart) return;

  const zoom = d3zoom()
    .scaleExtent([0.3, 20]) // This controls how much you can unzoom (x0.5) and zoom (x20)
    .extent([
      [0, 0],
      [chart.width, chart.height],
    ])
    .wheelDelta(wheelDelta)
    .on('zoom', (event) => {
      event.sourceEvent.preventDefault();
      const zoomFunctions = updateChart(chart, keyValues, rotate, event);
      const newChart = { ...chart, x: zoomFunctions.newX, y: zoomFunctions.newY };
      setChart(newChart);
    })
    .filter(
      (event) => (event.button === 0 || event.button === 1) && (event.ctrlKey || event.shiftKey)
    )
    .on('end', () => {
      dispatchUpdateMustRedraw(true);
    });

  let debounceTimeoutId;

  function debounceUpdateTimePositionValues(timePositionLocal, interval) {
    clearTimeout(debounceTimeoutId);
    debounceTimeoutId = setTimeout(() => {
      dispatchUpdateTimePositionValues(timePositionLocal);
    }, interval);
  }

  const mousemove = (event, _value) => {
    // If not playing
    if (!simulationIsPlaying) {
      if (isGET(keyValues)) {
        // GET
        const timePositionLocal = rotate
          ? chart.y.invert(pointer(event, event.currentTarget)[1])
          : chart.x.invert(pointer(event, event.currentTarget)[0]);

        const positionLocal = rotate
          ? chart.x.invert(pointer(event, event.currentTarget)[0])
          : chart.y.invert(pointer(event, event.currentTarget)[1]);

        setLocalTime(timePositionLocal);
        setLocalPosition(positionLocal);

        debounceUpdateTimePositionValues(timePositionLocal, 15);
        const immediatePositionsValuesForPointer = interpolateOnTime(
          selectedTrainData,
          keyValues,
          LIST_VALUES_NAME_SPACE_TIME,
          timePositionLocal
        );
        updatePointers(chart, keyValues, listValues, immediatePositionsValuesForPointer, rotate);
      } else {
        // GEV
        const positionLocal = rotate
          ? chart.y.invert(pointer(event, event.currentTarget)[1])
          : chart.x.invert(pointer(event, event.currentTarget)[0]);
        const timePositionLocal = interpolateOnPosition(
          selectedTrainData,
          keyValues,
          positionLocal
        );
        const immediatePositionsValuesForPointer = interpolateOnTime(
          selectedTrainData,
          keyValues,
          LIST_VALUES_NAME_SPEED_SPACE,
          datetime2sec(timePositionLocal)
        );

        // GEV prepareData func multiply speeds by 3.6. We need to normalize that to make a convenitn pointer update
        LIST_VALUES_NAME_SPEED_SPACE.forEach((name) => {
          if (
            immediatePositionsValuesForPointer[name] &&
            !Number.isNaN(immediatePositionsValuesForPointer[name]?.time) &&
            !Number.isNaN(immediatePositionsValuesForPointer[name]?.speed)
          ) {
            immediatePositionsValuesForPointer[name].speed /= 3.6;
            immediatePositionsValuesForPointer[name].time = sec2datetime(
              immediatePositionsValuesForPointer[name].time
            );
          }
        });

        if (timePositionLocal) {
          debounceUpdateTimePositionValues(timePositionLocal, 15);
        }

        if (chart?.svg) {
          const verticalMark = pointer(event, event.currentTarget)[0];
          const horizontalMark = pointer(event, event.currentTarget)[1];
          chart.svg.selectAll('#vertical-line').attr('x1', verticalMark).attr('x2', verticalMark);
          chart.svg
            .selectAll('#horizontal-line')
            .attr('y1', horizontalMark)
            .attr('y2', horizontalMark);
          updatePointers(chart, keyValues, listValues, immediatePositionsValuesForPointer, rotate);
        }
      }

      // Update guideLines

      // USE THAT TO RESTORE THE STUFF ON REACREACTION on component via setMousePointers !
      setMousePos({
        x: pointer(event, event.currentTarget)[0],
        y: pointer(event, event.currentTarget)[1],
      });
    }
  };

  chart.svg
    .on('mouseover', () => displayGuide(chart, 1))
    .on('mousemove', mousemove)
    .on('wheel', (event) => {
      if (event.ctrlKey || event.shiftKey) {
        event.preventDefault();
      }
    })
    .call(zoom);

  drawGuideLines(chart);
};

export default enableInteractivity;
