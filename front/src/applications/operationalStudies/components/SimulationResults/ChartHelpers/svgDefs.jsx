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
    .style('fill', '#black');

  defs
    .append('pattern')
    .attr('id', 'plusPattern')
    .attr('width', 32)
    .attr('height', 32)
    .attr('patternTransform', 'scale(1) rotate(0)')
    .attr('patternUnits', 'userSpaceOnUse')
    .append('path')
    .attr('d', 'M16-8v6m0 4v6m8-8h-6m-4 0H8m8 24v6m0 4v6m8-8h-6m-4 0H8')
    .attr('stroke-linecap', 'square')
    .attr('stroke-width', 3)
    .attr('stroke', 'black')
    .attr('fill', 'black');

  const stdcmFilterDefinition = defs.append('filter');

  stdcmFilterDefinition.attr('id', 'stdcmFilter').attr('maskUnits', 'userSpaceOnUse');

  stdcmFilterDefinition
    .append('feDropShadow')
    .attr('stdDeviation', '5 5')
    .attr('in', 'SourceGraphic')
    .attr('flood-color', 'black')
    .attr('flood-opacity', '1')
    .attr('result', 'dropShadowStdcm');

  defs
    .append('pattern')
    .attr('id', 'hatchPatternDarkGray')
    .attr('width', hatchSize)
    .attr('height', hatchSize)
    .attr('patternTransform', `rotate(${rotation})`)
    .attr('patternUnits', 'userSpaceOnUse')
    .append('rect')
    .attr('width', hatchSize / 2)
    .attr('height', hatchSize)
    .style('fill', '#747678');

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
