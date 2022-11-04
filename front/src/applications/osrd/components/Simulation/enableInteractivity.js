import * as d3 from 'd3';
import { zoom as d3zoom } from 'd3-zoom';
import { pointer } from 'd3-selection';

import {
  gridX,
  gridY,
  interpolateOnPosition,
  interpolateOnTime,
} from 'applications/osrd/components/Helpers/ChartHelpers';
import {
  updateChartXGEV,
  updateContextMenu,
  updateMustRedraw,
  updateTimePositionValues,
} from 'reducers/osrdsimulation';

import { LIST_VALUES_NAME_SPACE_TIME } from 'applications/osrd/components/Simulation/consts';
import drawGuideLines from 'applications/osrd/components/Simulation/drawGuideLines';
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

export const updatePointers = (chart, keyValues, listValues, positionValues, rotate) => {
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
  });
};

const updateChart = (chart, keyValues, rotate, event) => {
  // recover the new scale & test if movement under 0
  const newX = (event.sourceEvent.shiftKey && rotate)
    || ((chart.x.domain()[0] - event.transform.x) < 0 && event.transform.k === 1 && rotate)
    ? chart.x
    : event.transform.rescaleX(chart.x);
  const newY = (event.sourceEvent.shiftKey && !rotate)
    || ((chart.y.domain()[0] + event.transform.y) < 0 && event.transform.k === 1 && !rotate)
    ? chart.y
    : event.transform.rescaleY(chart.y);
/*
  const newX = event.sourceEvent.shiftKey && rotate ? chart.x : event.transform.rescaleX(chart.x);
  const newY = event.sourceEvent.shiftKey && !rotate ? chart.y : event.transform.rescaleY(chart.y);
  */
  console.log(chart.x.domain[0])
  console.log(event.sourceEvent.shiftKey)

  // update axes with these new boundaries
  const axisBottomX =
    !rotate && keyValues[0] === 'time'
      ? d3.axisBottom(newX).tickFormat(d3.timeFormat('%H:%M:%S'))
      : d3.axisBottom(newX);
  const axisLeftY =
    rotate && keyValues[0] === 'time'
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
          ? newY(d[`${keyValues[0]}_end`] - d[`${keyValues[0]}_start`])
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

  // chart.drawZone.selectAll('rect.route-aspect')
  // .attr('x', d => {console.log(d)})

  chart.drawZone.selectAll('.area').attr(
    'd',
    rotate
      ? d3
          .area()
          .y((d) => newY(d[keyValues[0]]))
          .x0((d) => newX(d.value0))
          .x1((d) => newX(d.value1))
          .curve(keyValues[0] === 'time' ? d3.curveStepAfter : d3.curveLinear)
      : d3
          .area()
          .x((d) => newX(d[keyValues[0]]))
          .y0((d) => newY(d.value0))
          .y1((d) => newY(d.value1))
          .curve(keyValues[0] === 'time' ? d3.curveStepAfter : d3.curveLinear)
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
  dataSimulation,
  keyValues,
  listValues,
  positionValues,
  refValueName,
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
            keyValues[0] !== 'time' && positionValues.speed
              ? positionValues.speed.position
              : timePosition
          )
        )
        .attr(
          'y2',
          chart.y(
            keyValues[0] !== 'time' && positionValues.speed
              ? positionValues.speed.position
              : timePosition
          )
        );
    } else {
      chart.svg
        .selectAll('#vertical-line')
        .attr(
          'x1',
          chart.x(
            keyValues[0] !== 'time' && positionValues.speed
              ? positionValues.speed.position
              : timePosition
          )
        )
        .attr(
          'x2',
          chart.x(
            keyValues[0] !== 'time' && positionValues.speed
              ? positionValues.speed.position
              : timePosition
          )
        );
    }

    updatePointers(chart, keyValues, listValues, positionValues, rotate);
  }
};

const enableInteractivity = (
  chart,
  dataSimulation,
  dispatch,
  keyValues,
  listValues,
  positionValues,
  rotate,
  setChart,
  setYPosition,
  setZoomLevel,
  yPosition,
  zoomLevel
) => {
  if (!chart) return;

  let newHoverPosition;

  let lastChartX;

  // Ovverride the default wheelDelta computation to get smoother zoom
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

  const zoom = d3zoom(newHoverPosition)
    .scaleExtent([0.3, 20]) // This control how much you can unzoom (x0.5) and zoom (x20)
    .extent([
      [0, 0],
      [chart.width, chart.height],
    ])
    .wheelDelta(wheelDelta)
    .on('zoom', (event) => {
      console.log('zoom event', event);
      console.log('zoom event', event.shiftKey);
      // Permit zoom if shift pressed, if only move or if factor > .5
      //if (event.sourceEvent.ctrlKey || event.sourceEvent.shiftKey) {
      /* || d3.event.transform.k >= 1
        || zoomLevel >= 0.25)) { */
      const eventTransform = event.transform;

      //chart.drawZone.attr("transform", eventTransform)

      event.sourceEvent.preventDefault();
      console.log('zoomLevel', zoomLevel * eventTransform.k);
      console.log('tranform K', eventTransform.k);


      const zoomFunctions = updateChart(chart, keyValues, rotate, event);
      const newChart = { ...chart, x: zoomFunctions.newX, y: zoomFunctions.newY };
      lastChartX = zoomFunctions.newX;
      setChart(newChart);

      //setZoomLevel(zoomLevel * eventTransform.k);
      //setYPosition(yPosition + eventTransform.y);
      //}
    })
    .filter(
      (event) => {
        console.log("event", event)
        return (event.button === 0 || event.button === 1) && (event.ctrlKey || event.shiftKey)
      }
    )
    .on('start', () => {
      dispatch(updateContextMenu(undefined));
    })
    .on('end', () => {
      if (keyValues[1] === 'speed' || keyValues[1] === 'gradient') {
        //dispatch(updateChartXGEV(lastChartX));
      }
      dispatch(updateMustRedraw(true));
    });

  let debounceTimeoutId;

  function debounceUpdateTimePositionValues(timePositionLocal, immediatePositionsValues, interval) {
    clearTimeout(debounceTimeoutId);
    debounceTimeoutId = setTimeout(() => {
      dispatch(updateTimePositionValues(timePositionLocal, null));
    }, interval);
  }

  const mousemove = (event, value) => {
    // If GET && not playing
    const { osrdsimulation } = store.getState();
    if (!osrdsimulation.isPlaying) {
      if (keyValues[0] === 'time') {
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

export default enableInteractivity;
