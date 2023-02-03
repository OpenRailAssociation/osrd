const drawLegendToggle = (chart, classes, groupID, rotate, legend, text, isSelected = false) => {
  const drawZone = chart.drawZone.select(`#${groupID}`);

  // prepare box shadow filter for button
  const filter = drawZone.append('filter').attr('id', 'dropshadow');

  filter
    .append('feGaussianBlur')
    .attr('in', 'SourceAlpha')
    .attr('stdDeviation', 2)
    .attr('result', 'blur');

  filter.append('feOffset').attr('in', 'blur').attr('result', 'offsetBlur');

  filter
    .append('feFlood')
    .attr('in', 'offsetBlur')
    .attr('flood-color', '#333')
    .attr('flood-opacity', '0.5')
    .attr('result', 'offsetColor');

  filter
    .append('feComposite')
    .attr('in', 'offsetColor')
    .attr('in2', 'offsetBlur')
    .attr('operator', 'in')
    .attr('result', 'offsetBlur');

  const feMerge = filter.append('feMerge');

  feMerge.append('feMergeNode').attr('in', 'offsetBlur');

  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  // add button toggle
  drawZone
    .append('circle')
    .attr('class', `circle ${classes}`)
    .style('fill', '#FFF')
    .attr('filter', 'url(#dropshadow)')
    .attr('cy', 30)
    .attr('cx', rotate ? '10%' : '5%')
    .attr('r', 18);

  // add text to button
  drawZone
    .append('text')
    .attr('class', `circleText ${classes}`)
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'middle')
    .text(text)
    .attr('fill', '#303383')
    .attr('font-size', 15)
    .attr('font-weight', 'bolder')
    .attr('y', 30)
    .attr('x', rotate ? '10%' : '5%');

  // add click interraction to button
  drawZone.selectAll(`.${classes}`).on('click', () => {
    isSelected = !isSelected;

    // figure out what to do if button is clicked
    if (isSelected) {
      // add main rect legend
      drawZone.select('.circle').style('fill', '#303383');
      drawZone.select('.circleText').attr('fill', '#FFF');
      drawZone
        .append('rect')
        .attr('class', 'rect legend')
        .attr('fill', '#333')
        .attr('rx', 4)
        .attr('ry', 4)
        .attr('y', 10)
        .attr('x', rotate ? '12%' : '7%')
        .attr('width', '15%')
        .attr('height', 210);

      // add legend title
      drawZone
        .append('text')
        .attr('class', 'legend')
        .attr('dominant-baseline', 'middle')
        .text('Légende')
        .attr('fill', '#FFF')
        .attr('y', 25)
        .attr('x', rotate ? '13%' : '8%')
        .attr('font-weight', 'bold');

      // loop legend array to add icons rect and text
      legend.forEach((profile, index) => {
        drawZone
          .append('rect')
          .attr('class', 'rect legend')
          .attr('fill', '#FFF')
          .attr('rx', 2)
          .attr('ry', 2)
          .attr('y', `${40 + index * 30}`)
          .attr('x', rotate ? '13%' : '8%')
          .attr('width', '2%')
          .attr('height', 20);

        drawZone
          .append('text')
          .attr('class', 'text legend')
          .attr('dominant-baseline', 'middle')
          .text(profile.mode)
          .attr('fill', '#FFF')
          .attr('y', `${53 + index * 30}`)
          .attr('x', rotate ? '16%' : '11%');

        // loop color array propriety in legend
        profile.color.forEach((color, colorIndex) => {
          // figure out how many lines show in the icon or if it has to be striped
          if (!profile.isStriped) {
            let yPosition;

            if (profile.color.length === 3) {
              yPosition = 44 + colorIndex * 6 + index * 30;
            } else if (profile.color.length === 2) {
              yPosition = 47 + colorIndex * 6 + index * 30;
            } else {
              yPosition = 50 + index * 30;
            }
            drawZone
              .append('line')
              .attr('class', 'line legend')
              .attr('fill', 'none')
              .attr('stroke-width', '4')
              .attr('stroke', color)
              .attr('x1', rotate ? '13.2%' : '8.2%')
              .attr('y1', `${yPosition}`)
              .attr('x2', rotate ? '14.8%' : '9.8%')
              .attr('y2', `${yPosition}`);
          } else {
            // prepare stripe pattern
            const stripe = chart.drawZone.select(`#${groupID}`);
            stripe

              .append('pattern')
              .attr('id', `rect_${index}`)
              .attr('patternUnits', 'userSpaceOnUse')
              .attr('width', 8)
              .attr('height', 8)
              .append('path')
              .attr('d', 'M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4')
              .attr('stroke', color)
              .attr('stroke-width', 2.5);

            // add striped icon
            drawZone
              .append('rect')
              .attr('class', 'rect legend')
              .attr('fill', `url(#rect_${index})`)
              .attr('x', rotate ? '13.2%' : '8.2%')
              .attr('y', `${44 + index * 30}`)
              .attr('width', '1.6%')
              .attr('height', '12');
          }
        });
      });
    } else {
      // add click interraction on button to remove legend
      drawZone.select('.circle').style('fill', '#FFF');
      drawZone.select('.circleText').attr('fill', '#303383');
      drawZone.selectAll('.legend').remove();
    }
  });
};

export default drawLegendToggle;
