import * as d3 from 'd3';

import React, { useEffect, useRef, useState } from 'react';

const snappedHeight = 200;
const chartID = "now"
//const width = parseInt(d3.select(`#container-${chartID}`).style('width'), 10) ?? 600;
const width = 1000;
const height = 100;
const margin = {top: 25, bottom: 25, left: 40, right: 40}
const stops = [200, 300, 400, 460, 500, 600, 650, 780];

export default function MarecoMultiRange(props) {
  const d3Container = useRef(null);
  const brushesContainer = useRef(null);
  const brushesRef = useRef([]);
  const [brushes, setBrushes] = useState([]);
  const x = d3
    .scaleLinear()
    .domain([Math.min(...stops), Math.max(...stops)])
    .range([0, width]);

  const qu = d3
    .scaleQuantize()
    .domain([Math.min(...stops), Math.max(...stops)])
    .range(stops);

  const xAxis = (node) =>
    node
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3
          .axisTop(x)
          .tickValues(stops)
          .tickSize(height - margin.bottom * 2)
        //.ticks(d3.timeMonth.every(1))
        //.tickFormat((d) => (d <= d3.timeYear(d) ? d.getFullYear() : null))
      )
      .call((g) => g.select(".domain").remove());

  const xAxis2 = (node) =>
  node
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(
          d3.axisBottom(x)
          //.ticks(d3.timeMonth.every(1))
          //.tickFormat((d) => (d <= d3.timeYear(d) ? d.getFullYear() : null))
        )
        .call((g) => g.select(".domain").remove());

  function newBrush(qu) {
    const brush = d3
      .brushX()
      .extent([[0, 0], [800, 50]]);
    // .on('start', brushstart) // Make sure don't pass surrounding brushes
    // .on('brush', brushed) // Make sure don't pass surrounding brushes
    // .on('end', brushend); // Keep track of what brushes is surrounding
    console.log("newBrushes", brushes)
    setBrushes(brushes => [...brushes, { id: brushes.length, brush }]);
  }

  useEffect(
    () => {

      console.log("Entering brush effect", brushesRef.current)

      for(let i = 0; i < brushesRef.current.length; i++) {
        console.log(d3.select(brushesRef.current[i]))
        d3.select(brushesRef.current[i]).call(brushes[i].brush)
      }

      /*
      if (brushesContainer.current) {
        const gBrushes = d3.select(brushesContainer.current);
        console.log("Pre binding", brushes)
        // binding
        const update = gBrushes.selectAll('g.brush').data(brushes, (d) => d.id);

        update.enter()
          .append('g', '.brush')
          .attr('class', 'brush')
          .call(function(d) {
            console.log("call: ")
            console.log(d)
            console.log(d.data()); // d is selection
            //id.call(d.data().brush)
          })

          /*
          .call((selection) => {
            console.log(selection);
            console.log(selection.__data__);
            const brush = selection.__data__
            if(brush) selection.call(brush.brush)
          })



          update
          .call((selection) => {
            console.log(selection);
            console.log(selection.__data__);
          })


        update.exit()
          .remove();

          gBrushes.selectAll('g.brush').each((brushWrapper) => {
            console.log("EACH after")
            console.log(brushWrapper)
            console.log(d3.select(this))
            d3.select(this).call(brushWrapper.brush)
          })
          */

    }, [brushes],
  );

  useEffect(
    () => {
      d3.select(d3Container.current).append("g").style("background-color", "grey").call(xAxis);
      d3.select(d3Container.current).append("g").style("background-color", "grey").call(xAxis2);
      newBrush();
    },
    [],
  );

  /*
  useEffect(
    () => {
      function getSurroundingEdges(brushes, selection, brush) {
        let edgeUp = Math.max(...stops);
        let edgeDown = Math.min(...stops);

        brushes.forEach((otherBrush) => {
          if (otherBrush.currentSelection && otherBrush !== brush) {
            const currentEdgeUpCandidate = otherBrush.currentSelection[0];
            const currentEdgeDownCandidate = otherBrush.currentSelection[1];
            if (
              currentEdgeUpCandidate < edgeUp
              && currentEdgeDownCandidate > selection[1]
            ) { edgeUp = currentEdgeUpCandidate; }
            if (
              currentEdgeDownCandidate > edgeDown
              && currentEdgeUpCandidate < selection[0]
            ) { edgeDown = currentEdgeDownCandidate; }
          }
        });
        return [edgeDown, edgeUp];
      }
      function update(brushes, svg) {

        console.log("ENTER BRUSH UPDATE, brushes", brushes)
        console.log("ENTER BRUSH UPDATE, brushContainer", d3.select(brushesContainer.current))

        let gBrush = d3.select(brushesContainer.current).selectAll('.brush').data(brushes, (d) => d.id);

        console.log("ENTER gBRUSH UPDATE", gBrush)

        gBrush
          .enter()
          .insert('g', '.brush')
          .attr('class', 'brush')

        console.log("ENTER gBRUSH aftet append", gBrush)

        gBrush.each((brushWrapper) => {
          console.log("Each brush wrapper enter")
          console.log(brushWrapper)
          console.log(d3.select(this))
          console.log(brushWrapper.brush)
          d3.select(this).call(brushWrapper.brush);
        });

        gBrush.each((brushWrapper, i) => {
          console.log('overlay each')
          d3.select(this)
            .attr('class', `brush brush-${i}`)
            .selectAll('.overlay')
            .style('pointer-events', () => {
              const { brush } = brushWrapper;

              // && brush.extent()[0].getTime() === brush.extent()[1].getTime()

              return i === brushes.length - 1 && brush !== undefined
                ? 'all'
                : 'none';
            });
        });

        gBrush.selectAll('rect').attr('height', snappedHeight);
      }

      // new brush handler
      function newBrush(qu) {
        const brush = d3
          .brushX()
          .extent([0,0], [800, 200])
          .on('start', brushstart) // Make sure don't pass surrounding brushes
          .on('brush', brushed) // Make sure don't pass surrounding brushes
          .on('end', brushend); // Keep track of what brushes is surrounding

        setBrushes(brushes.push({ id: brushes.length, brush }));

        function brushstart({ sourceEvent }) {
          // console.log("BrushStart sourceEvent ", sourceEvent);
          /*
          if (d3.event.sourceEvent) brush.mouseStart = d3.event.sourceEvent.x;

          if (brush.extent.start == undefined) {
            d3.event.sourceEvent.x;
          }

        }

        function brushed({
          mode, sourceEvent, selection, target,
        }) {
          console.log('Brushed sourceEvent ', target);
          if (!sourceEvent) return;
          // console.log("Brush mode ", mode);
          target.currentSelection = selection.map((s) => x.invert(s));

          const normalizedSelection = selection.map((s) => x.invert(s));
          const edges = getSurroundingEdges(
            brushes.map((d) => d.brush),
            normalizedSelection,
            target,
          );
          if (
            normalizedSelection[0] <= edges[0]
            || normalizedSelection[1] >= edges[1]
          ) {
            if (normalizedSelection[0] <= edges[0]) {
              d3.select(this).call(
                brush.move,
                [edges[0], normalizedSelection[1]].map(x),
              );
            }
            if (normalizedSelection[1] >= edges[1]) {
              d3.select(this).call(
                brush.move,
                [normalizedSelection[0], edges[1]].map(x),
              );
            }
          }
        }

        function brushend({
          selection, sourceEvent, mode, target,
        }) {
          // add a new brush as needed
          console.log('Mode on end', mode);
          if (!sourceEvent) return;
          const newExtent = selection.map((s) => qu(x.invert(s)));
          target.currentSelection = newExtent;
          d3.select(this).call(brush.move, newExtent.map(x));
          // var lastBrushExtent = brushes[brushes.length - 1].brush.extent();

          // if (lastBrushExtent[0].getTime() != lastBrushExtent[1].getTime())
          newBrush(brushes); /// Only on drag mode

          update();
        }
      }

      if (d3Container.current) {
        const svg = d3.select(d3Container.current);

        console.log("ENTER IN EFFECT")
        // brushes container
        //const gBrushes = svg.append('g').attr('class', 'brushes');

        const gBrushes = d3.select(brushesContainer.current);

        // keep track of existing brushes
        let brushes = [];

        const x = d3
          .scaleLinear()
          .domain([Math.min(...stops), Math.max(...stops)])
          .range([0, width]);

        const quantize = d3
          .scaleQuantize()
          .domain([Math.min(...stops), Math.max(...stops)])
          .range(stops);

          svg
          .attr("viewBox", [0, 0, width, snappedHeight])
          .attr("width", width)
          .attr("height", snappedHeight + margin.top + margin.bottom);

        const xAxis = (node) => node
          .attr('transform', `translate(0,${snappedHeight})`)
          .call(
            d3
              .axisTop(x)
              .tickValues(stops)
              .tickSize(snappedHeight),
            // .ticks(d3.timeMonth.every(1))
            // .tickFormat((d) => (d <= d3.timeYear(d) ? d.getFullYear() : null))
          )
          .call((g) => g.select('.domain').remove());

        svg.append('g').style('background-color', 'grey').call(xAxis);

        const xAxis2 = (node) => node
          .attr('transform', `translate(0,${snappedHeight})`)
          .call(
            d3.axisBottom(x),

          )
          .call((g) => g.select('.domain').remove());

        svg.append('g').style('background-color', 'grey').call(xAxis2);

        newBrush(brushes, quantize);
        update(brushes, svg);
      }
    },

        useEffect has a dependency array (below). It's a list of dependency
        variables for this useEffect block. The block will run after mount
        and whenever any of these variables change. We still have to check
        if the variables are valid, but we do not have to compare old props
        to next props to decide whether to rerender.

    [],
  );
  */

  return (
    <>
      <svg
        className="d3-component w-100"
        //viewBox="0 0 800 200"
        height={height}
        //width={800}
        ref={d3Container}
      >
        <g
          className="brushes"
          ref={brushesContainer}
        >
          {brushes.map((brush, i) =>
          (
          <g
            key={i}
            ref={el => brushesRef.current[i] = el}
            className="brush" brush={brush}></g>
          ))}
        </g>
      </svg>
    </>
  );
}
