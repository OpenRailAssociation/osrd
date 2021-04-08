import * as d3 from 'd3';

const drawArea = (
  chart, pattern = 'gray', dataSimulation, groupID, interpolation, keyValues, name,
  offsetTimeByDragging, rotate, setMustRedraw = () => {}, setSelectedTrain = () => {},
) => { // Pattern could be a color or a pattern defined in svgDefs with syntax 'url(#idOfPAttern)'
  const initialDrag = rotate
    ? chart.y.invert(0)
    : chart.x.invert(0);
  let i = 0;

  const drag = d3.drag()
    .on('end', () => {})
    .on('start', () => {})
    .on('drag', () => {
      const value = rotate
        ? Math.floor((chart.y.invert(d3.event.dy) - initialDrag) / 1000)
        : Math.floor((chart.x.invert(d3.event.dx) - initialDrag) / 1000);
      if (i !== 1) {
        offsetTimeByDragging(value);
        setMustRedraw(true);
      }
      i += 1;
    });

  const dataDefinition = rotate
    ? d3.area()
      .y((d) => chart.y(d[keyValues[0]]))
      .x0((d) => chart.x(d.value0))
      .x1((d) => chart.x(d.value1))
      .curve(d3[interpolation])
    : d3.area()
      .x((d) => chart.x(d[keyValues[0]]))
      .y0((d) => chart.y(d.value0))
      .y1((d) => chart.y(d.value1))
      .curve(d3[interpolation]);

  chart.drawZone.select(`#${groupID}`).append('path')
    .on('click', () => {
      setSelectedTrain(dataSimulation.trainNumber);
      setMustRedraw(true);
    })
    .attr('class', 'area zoomable')
    .datum(dataSimulation[name])
    // .attr('fill', color)
    .attr('fill', pattern)
    .attr('d', dataDefinition)
    .call(drag);
};

export default drawArea;
