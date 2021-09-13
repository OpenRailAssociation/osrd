import * as d3 from 'd3';
import drawGuideLines from 'applications/osrd/components/Simulation/drawGuideLines';
import { gridX, gridY } from 'applications/osrd/components/Helpers/ChartHelpers';
import { updateHoverPosition, updateMustRedraw, updateTimePosition } from 'reducers/osrdsimulation';
import { time2datetime } from 'utils/timeManipulation';

export const displayGuide = (chart, opacity) => {
  chart.svg.selectAll('#vertical-line').style('opacity', opacity);
  chart.svg.selectAll('#horizontal-line').style('opacity', opacity);
  chart.svg.selectAll('.pointer').style('opacity', opacity);
};

export const updatePointers = (
  chart, dataSimulation, hoverPosition, keyValues, listValues, rotate,
) => {
  listValues.forEach((name) => {
    if (dataSimulation[name][hoverPosition] !== undefined) {
      chart.svg.selectAll(`#pointer-${name}`)
        .attr('cx', (rotate
          ? chart.x(dataSimulation[name][hoverPosition][keyValues[1]])
          : chart.x(dataSimulation[name][hoverPosition][keyValues[0]])))
        .attr('cy', (rotate
          ? chart.y(dataSimulation[name][hoverPosition][keyValues[0]])
          : chart.y(dataSimulation[name][hoverPosition][keyValues[1]])));
    }
  });
};

const updateChart = (chart, keyValues, rotate) => {
  // recover the new scale
  const newX = d3.event.sourceEvent.shiftKey && rotate
    ? chart.x : d3.event.transform.rescaleX(chart.x);
  const newY = d3.event.sourceEvent.shiftKey && !rotate
    ? chart.y : d3.event.transform.rescaleY(chart.y);

  // update axes with these new boundaries
  const axisBottomX = !rotate && keyValues[0] === 'time'
    ? d3.axisBottom(newX).tickFormat(d3.timeFormat('%H:%M:%S')) : d3.axisBottom(newX);
  const axisLeftY = rotate && keyValues[0] === 'time'
    ? d3.axisLeft(newY).tickFormat(d3.timeFormat('%H:%M:%S')) : d3.axisLeft(newY);
  chart.xAxis.call(axisBottomX);
  chart.yAxis.call(axisLeftY);

  chart.xAxisGrid.call(gridX(newX, chart.height));
  chart.yAxisGrid.call(gridY(newY, chart.width));

  // update lines & areas
  chart.drawZone
    .selectAll('.line')
    .attr('d', d3.line()
      .x((d) => newX((rotate ? d[keyValues[1]] : d[keyValues[0]])))
      .y((d) => newY((rotate ? d[keyValues[0]] : d[keyValues[1]]))));

  chart.drawZone
    .selectAll('.area')
    .attr('d', (rotate
      ? d3.area()
        .y((d) => newY(d[keyValues[0]]))
        .x0((d) => newX(d.value0))
        .x1((d) => newX(d.value1))
      : d3.area()
        .x((d) => newX(d[keyValues[0]]))
        .y0((d) => newY(d.value0))
        .y1((d) => newY(d.value1))));

  chart.drawZone
    .selectAll('.conflictsPoints')
    .attr('cx', (d) => newX((rotate ? d[keyValues[1]] : d[keyValues[0]])))
    .attr('cy', (d) => newY((rotate ? d[keyValues[0]] : d[keyValues[1]])));
  return { newX, newY };
};

export const traceVerticalLine = (
  chart, dataSimulation, hoverPosition, keyValues, listValues,
  refValueName, rotate, timePosition,
) => {
  if (chart !== undefined
    && d3.event === null) {
    displayGuide(chart, 1);
    const valuePosition = time2datetime(timePosition);
    /* const valuePosition = dataSimulation[refValueName][hoverPosition][keyValues[0]]; */
    if (rotate) {
      // chart.svg.selectAll('#vertical-line').style('opacity', 0);
      chart.svg.selectAll('#horizontal-line')
        .attr('y1', chart.y(valuePosition))
        .attr('y2', chart.y(valuePosition));
    } else {
      // chart.svg.selectAll('#horizontal-line').style('opacity', 0);
      chart.svg.selectAll('#vertical-line')
        .attr('x1', chart.x(valuePosition))
        .attr('x2', chart.x(valuePosition));
    }
    if (dataSimulation[refValueName][hoverPosition] !== undefined) {
      updatePointers(
        chart, dataSimulation, hoverPosition, keyValues,
        listValues, rotate,
      );
    }
  }
};

const enableInteractivity = (
  chart, dataSimulation, dispatch, keyValues,
  listValues, rotate,
  setChart, setYPosition, setZoomLevel, yPosition, zoomLevel,
) => {
  let newHoverPosition;

  const zoom = d3.zoom(newHoverPosition)
    .scaleExtent([0.5, 20]) // This control how much you can unzoom (x0.5) and zoom (x20)
    .extent([[0, 0], [chart.width, chart.height]])
    .on('zoom', () => {
      // Permit zoom if shift pressed, if only move or if factor > .5
      if ((d3.event.sourceEvent.shiftKey
        || d3.event.transform.k >= 1
        || zoomLevel >= 0.5)
        && (chart.y.domain()[0] >= 0 || d3.event.transform.y >= 0 || d3.event.transform.k !== 1)) {
        console.log(chart.y.domain()[0]);
        setZoomLevel(zoomLevel * d3.event.transform.k);
        setYPosition(yPosition + d3.event.transform.y);
        const zoomFunctions = updateChart(chart, keyValues, rotate);
        const newChart = { ...chart, x: zoomFunctions.newX, y: zoomFunctions.newY };
        setChart(newChart);
        updatePointers(
          newChart, dataSimulation, newHoverPosition, keyValues, listValues, rotate,
        );
      }
    })
    .filter(() => d3.event.button === 0 || d3.event.button === 1)
    .on('end', () => dispatch(updateMustRedraw(true)));

  const mousemove = () => {
    // recover coordinate we need
    const valuePosition = rotate
      ? chart.y.invert(d3.mouse(d3.event.currentTarget)[1])
      : chart.x.invert(d3.mouse(d3.event.currentTarget)[0]);
    const bisect = d3.bisector((d) => d[keyValues[0]]).left;
    newHoverPosition = bisect(dataSimulation[listValues[0]], valuePosition, 1);
    if (keyValues[0] === 'time') {
      dispatch(updateTimePosition(valuePosition.toLocaleTimeString('fr-FR')));
    }

    // Update guideLines
    chart.svg.selectAll('#vertical-line')
      .attr('x1', d3.mouse(d3.event.currentTarget)[0])
      .attr('x2', d3.mouse(d3.event.currentTarget)[0]);
    chart.svg.selectAll('#horizontal-line')
      .attr('y1', d3.mouse(d3.event.currentTarget)[1])
      .attr('y2', d3.mouse(d3.event.currentTarget)[1]);

    dispatch(updateHoverPosition(newHoverPosition));
  };

  chart.svg // .selectAll('.zoomable')
    .on('mouseover', () => displayGuide(chart, 1))
    .on('mousemove', () => mousemove())
    .call(zoom);
  drawGuideLines(chart);
};

export default enableInteractivity;
