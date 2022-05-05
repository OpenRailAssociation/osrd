import * as d3 from 'd3';

import React, { useEffect, useRef } from 'react';

export default function MarecoMultiRange(props) {

  const d3Container = useRef(null);

  useEffect(
    () => {
      if (d3Container.current) {

        function getSurroundingEdges(brushes, selection, brush) {
          let edgeUp = Math.max(...stops);
          let edgeDown = Math.min(...stops);

          brushes.forEach(function (otherBrush) {
            if (otherBrush.currentSelection && otherBrush !== brush) {
              const currentEdgeUpCandidate = otherBrush.currentSelection[0];
              const currentEdgeDownCandidate = otherBrush.currentSelection[1];
              if (
                currentEdgeUpCandidate < edgeUp &&
                currentEdgeDownCandidate > selection[1]
              )
                edgeUp = currentEdgeUpCandidate;
              if (
                currentEdgeDownCandidate > edgeDown &&
                currentEdgeUpCandidate < selection[0]
              )
                edgeDown = currentEdgeDownCandidate;
            }
          });
          return [edgeDown, edgeUp];
        }

        const svg = d3.select(d3Container.current);
        const snappedHeight = 200;
        const width = 600;
        const stops = [200, 300, 400, 460, 500, 600, 650, 780];

        const x = d3
          .scaleLinear()
          .domain([Math.min(...stops), Math.max(...stops)])
          .range([0, width]);

        const qu = d3
          .scaleQuantize()
          .domain([Math.min(...stops), Math.max(...stops)])
          .range(stops);

        /*
          svg
          .attr("viewBox", [0, 0, width, snappedHeight])
          .attr("width", width)
          .attr("height", snappedHeight + margin.top + margin.bottom);
          */

        const xAxis = (node) => node
          .attr('transform', `translate(0,${snappedHeight})`)
          .call(
            d3
              .axisTop(x)
              .tickValues(stops)
              .tickSize(snappedHeight)
            //.ticks(d3.timeMonth.every(1))
            //.tickFormat((d) => (d <= d3.timeYear(d) ? d.getFullYear() : null))
          )
          .call((g) => g.select('.domain').remove());

        svg.append('g').style('background-color', 'grey').call(xAxis);

        const xAxis2 = (node) => node
          .attr('transform', `translate(0,${snappedHeight})`)
          .call(
            d3.axisBottom(x)
            //.ticks(d3.timeMonth.every(1))
            //.tickFormat((d) => (d <= d3.timeYear(d) ? d.getFullYear() : null))
          )
          .call((g) => g.select('.domain').remove());

        svg.append('g').style('background-color', 'grey').call(xAxis2);

          //brushes container
        const gBrushes = svg.append('g').attr('class', 'brushes');

          //keep track of existing brushes
        const brushes = [];



          //new brush handler
        function newBrush() {
          var brush = d3
            .brushX()
            .on('start', brushstart) //Make sure don't pass surrounding brushes
            .on('brush', brushed) //Make sure don't pass surrounding brushes
            .on('end', brushend); //Keep track of what brushes is surrounding

          brushes.push({ id: brushes.length, brush: brush });

          function brushstart({ sourceEvent }) {
            //console.log("BrushStart sourceEvent ", sourceEvent);
            /*
            if (d3.event.sourceEvent) brush.mouseStart = d3.event.sourceEvent.x;

            if (brush.extent.start == undefined) {
              d3.event.sourceEvent.x;
            }
        */
          }

          function brushed({ mode, sourceEvent, selection, target }) {
            console.log('Brushed sourceEvent ', target);
            if (!sourceEvent) return;
            //console.log("Brush mode ", mode);
            target.currentSelection = selection.map((s) => x.invert(s));

            const normalizedSelection = selection.map((s) => x.invert(s));
            const edges = getSurroundingEdges(
              brushes.map(function (d) {
                return d.brush;
              }),
              normalizedSelection,
              target
            );
            if (
              normalizedSelection[0] <= edges[0] ||
              normalizedSelection[1] >= edges[1]
            ) {
              if (normalizedSelection[0] <= edges[0]) {
                d3.select(this).call(
                  brush.move,
                  [edges[0], normalizedSelection[1]].map(x)
                );
              }
              if (normalizedSelection[1] >= edges[1]) {
                d3.select(this).call(
                  brush.move,
                  [normalizedSelection[0], edges[1]].map(x)
                );
              }
            }
          }

          function brushend({ selection, sourceEvent, mode, target }) {
            //add a new brush as needed
            console.log('Mode on end', mode);
            if (!sourceEvent) return;
            const newExtent = selection.map((s) => qu(x.invert(s)));
            target.currentSelection = newExtent;
            d3.select(this).call(brush.move, newExtent.map(x));
            //var lastBrushExtent = brushes[brushes.length - 1].brush.extent();

            //if (lastBrushExtent[0].getTime() != lastBrushExtent[1].getTime())
            newBrush(); /// Only on drag mode

            update();
          }
        }

        function update() {
          var gBrush = gBrushes.selectAll('.brush').data(brushes, function (d) {
            return d.id;
          });

          gBrush
            .enter()
            .insert('g', '.brush')
            .attr('class', 'brush')
            .each(function (brushWrapper) {
              d3.select(this).call(brushWrapper.brush);
            });

          gBrush.each(function (brushWrapper, i) {
            d3.select(this)
              .attr('class', 'brush brush-' + i)
              .selectAll('.overlay')
              .style('pointer-events', function () {
                var brush = brushWrapper.brush;

                // && brush.extent()[0].getTime() === brush.extent()[1].getTime()

                return i === brushes.length - 1 && brush !== undefined
                  ? 'all'
                  : 'none';
              });
          });

          gBrush.selectAll('rect').attr('height', snappedHeight);

        }

        newBrush();
        update();

      }
    },
    /*
        useEffect has a dependency array (below). It's a list of dependency
        variables for this useEffect block. The block will run after mount
        and whenever any of these variables change. We still have to check
        if the variables are valid, but we do not have to compare old props
        to next props to decide whether to rerender.
    */
    [d3Container.current])

  return (
    <>
      <svg
            className="d3-component  w-100"
            height={200}
            ref={d3Container}
        />
    </>
  )
}