const svgDefs = (defs) => {
  const hatchSize = 4;
  const rotation = 45;

  // Diagonal hatching
  defs
    .append('pattern')
    .attr('id', 'hatchPatternGray')
    .attr('width', hatchSize)
    .attr('height', hatchSize)
    .attr('patternTransform', `rotate(${rotation})`)
    .attr('patternUnits', 'userSpaceOnUse')
    .append('rect')
    .attr('width', hatchSize / 2)
    .attr('height', hatchSize)
    .style('fill', '#d7d7d7');

  defs
    .append('pattern')
    .attr('id', 'hatchPatternBlue')
    .attr('width', hatchSize)
    .attr('height', hatchSize)
    .attr('patternTransform', `rotate(${rotation})`)
    .attr('patternUnits', 'userSpaceOnUse')
    .append('rect')
    .attr('width', hatchSize / 2)
    .attr('height', hatchSize)
    .style('fill', '#82be00')
    .style('opacity', '0.1');
};

export default svgDefs;
