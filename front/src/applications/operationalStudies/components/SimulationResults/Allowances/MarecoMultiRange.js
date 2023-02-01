import * as d3 from 'd3';

import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { select } from 'd3-selection';

import { brushX } from 'd3-brush';

const useD3 = (renderChartFn, dependencies) => {
  const ref = React.useRef();

  React.useEffect(() => {
    renderChartFn(d3.select(ref.current));
    return () => {};
  }, dependencies);
  return ref;
};

// This pure func can be in an eternal helper
function getSurroundingEdges(brushes, selection, brush, flattenStops) {
  let edgeUp = Math.max(...flattenStops);
  let edgeDown = Math.min(...flattenStops);
  brushes.forEach((otherBrush) => {
    if (otherBrush.currentSelection && otherBrush !== brush) {
      const currentEdgeUpCandidate = otherBrush.currentSelection[0];
      const currentEdgeDownCandidate = otherBrush.currentSelection[1];
      if (currentEdgeUpCandidate < edgeUp && currentEdgeDownCandidate > selection[1]) {
        edgeUp = currentEdgeUpCandidate;
      }
      if (currentEdgeDownCandidate > edgeDown && currentEdgeUpCandidate < selection[0]) {
        edgeDown = currentEdgeDownCandidate;
      }
    }
  });
  return [edgeDown, edgeUp];
}

function getClosestStop(stops, value) {
  const closest = stops.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
  return closest;
}

const viewBoxHeight = 100;
const viewBoxWidth = 1000; // Can be const
const baseExtension = {
  id: 0,
  start: 0,
  end: 0,
}; // Pass trough props

export default function MarecoMultiRange({
  stops = [{}],
  extensions = [baseExtension],
  setExtensions = () => {},
}) {
  const brushesRef = useRef([]);
  const brushesContainer = useRef(null);
  const [brushes, setBrushes] = useState([]);
  const margin = {
    top: 25,
    right: 30,
    bottom: 25,
    left: 40,
  };

  const qu = d3
    .scaleOrdinal()
    .domain(stops.map((d) => d.position))
    .range(stops.map((d) => d.position));

  const x = d3
    .scaleLinear()
    .domain([Math.min(...stops.map((d) => d.position)), Math.max(...stops.map((d) => d.position))])
    .range([margin.left, viewBoxWidth - margin.right]);

  const ref = useD3(
    (svg) => {
      console.log('Begin useD3');

      // svg.select('g.brush-area').selectAll('g').remove()

      const xAxisStops = (node) =>
        node
          .attr('transform', `translate(0,${viewBoxHeight - margin.top - 6})`)
          .call(
            d3
              .axisTop(x)
              .tickValues(stops.map((d) => d.position))
              .tickSize(viewBoxHeight - margin.bottom - margin.top)
          )
          .call((g) => g.selectAll('g.tick').style('stroke-dasharray', 0.8));

      const axisStopsLabels = svg.select('.x-axis-stops-labels').selectAll('text').data(stops);

      axisStopsLabels
        .enter()
        .append('text')
        .attr('x', (d) => x(d.position))
        .attr('y', margin.top + 6)
        .attr('class', 'op-text')
        .attr('text-anchor', 'middle')
        .text((d) => d.name);

      const xAxisContinuous = (node) =>
        node
          .attr('transform', `translate(0,${viewBoxHeight - margin.bottom})`)
          .call(d3.axisBottom(x))
          .call((g) => g.select('.domain').remove());

      svg.select('.x-axis').call(xAxisContinuous);
      svg.select('.x-axis-stops').call(xAxisStops);

      const gBrushes = select(brushesContainer.current);

      const gBrush = gBrushes.selectAll('.brush').data(brushes, (d) => d.id);

      gBrush
        .enter()
        .insert('g', '.brush')
        .attr('class', 'brush')
        .each(function (brushWrapper, i) {
          select(this).call(brushWrapper.brush);
          select(this)
            .selectAll('.overlay')
            .style('pointer-events', () => {
              const { brush } = brushWrapper;

              return i === gBrush.size() && brush !== undefined ? 'all' : 'none';
            });
          if (brushWrapper.originalExtension) {
            select(this).call(
              brushWrapper.brush.move,
              [brushWrapper.originalExtension[0], brushWrapper.originalExtension[1]].map(x)
            );
          }
        });

      gBrush.exit().remove();

      // Move this up to avoid a BUG if further extension
      gBrush.each(function (brushWrapper, i) {
        select(this)
          .attr('class', `brush brush-${i}`)
          .selectAll('.overlay')
          .style('pointer-events', () => {
            const { brush } = brushWrapper;

            return i === gBrush.size() - 1 && brush !== undefined ? 'none' : 'none';
          });
      });

      console.log('end update useD3', brushes);

      // better FILTERING BEFORE SENDING BACK
      // only if different fro extensions sent

      const filteredExtensions = brushes
        .filter((d) => d.currentSelection && d.currentSelection[0] !== undefined)
        .reduce((unique, item) => (unique.includes(item) ? unique : [...unique, item]), []);
      setExtensions(filteredExtensions);
    },
    [stops, brushes]
  );

  useEffect(() => {
    brushesRef.current = brushes;
    if (brushes.length === 0) {
      newBrush(qu);
    }
  }, [brushes]);

  useEffect(() => {
    // CELAN EVERYTHING IN THAT CASE TO ENSURE SYNC
    const brush = brushX()
      .extent([
        [margin.left, margin.top],
        [viewBoxWidth - margin.right, viewBoxHeight - margin.bottom - 6],
      ])
      .on('start', brushstart) // Make sure don't pass surrounding brushes
      .on('brush', brushed) // Make sure don't pass surrounding brushes
      .on('end', brushend); // Keep track of what brushes is surrounding

    const extensionMapped = extensions.map((extension, i) => ({
      id: brushesRef.current.length + i,
      brush,
      currentSelection: [extension.begin_position, extension.end_position],
      originalExtension: [extension.begin_position, extension.end_position],
      extensionData: extension.allowance_type,
    }));

    setBrushes((brushes) => [...brushes, ...extensionMapped]);
  }, [extensions]);

  function brushstart({ sourceEvent }) {
    // empty for now
  }

  const brushed = ({ mode, sourceEvent, selection, target }) => {
    if (!sourceEvent) return;

    // keep a ref to the selection
    target.currentSelection = selection.map((s) => x.invert(s));

    // Anti collision system
    const normalizedSelection = selection.map((s) => x.invert(s));
    const edges = getSurroundingEdges(
      brushesRef.current.map((d) => d.brush),
      normalizedSelection,
      target,
      stops.map((d) => d.position)
    );

    if (normalizedSelection[0] <= edges[0] || normalizedSelection[1] >= edges[1]) {
      const currentBrush = brushesRef.current.find((d) => d.brush == target);
      const currentSel = d3.selectAll('g.brush').filter((d) => d.brush == target);
      if (normalizedSelection[0] <= edges[0]) {
        currentSel.call(currentBrush.brush.move, [edges[0], normalizedSelection[1]].map(x));
      }
      if (normalizedSelection[1] >= edges[1]) {
        currentSel.call(currentBrush.brush.move, [normalizedSelection[0], edges[1]].map(x));
      }
    }
  };

  function brushend({ selection, sourceEvent, mode, target }) {
    // add a new brush as needed
    if (!sourceEvent || !selection) return;
    // const newExtent = selection.map((s) => qu(x.invert(s)));
    const newExtent = selection.map((s) =>
      getClosestStop(
        stops.map((d) => d.position),
        x.invert(s)
      )
    );
    const currentBrush = brushesRef.current.find((d) => d.brush == target);
    currentBrush.currentSelection = newExtent;

    select(this).call(target.move, newExtent.map(x));
    // TODO: only drag on new

    const roughMappedSelection = selection.map((s) => x.invert(s));
    const intersection = brushesRef.current
      .map((b) => b.currentSelection)
      .filter(
        (bS) => bS && (roughMappedSelection.includes(bS[0]) || roughMappedSelection.includes(bS[1]))
      );

    // Filtrer et remettre les bruhses à zero !! (Set Brushes)

    if (intersection.length === 0 && mode !== 'drag' && [newExtent[1] > newExtent[0]]) {
      newBrush();
    }
    // newBrush(); /// Only on drag mode
  }

  const newBrush = () => {
    console.log('new Brush', brushesRef.current);

    const brush = brushX()
      .extent([
        [margin.left, margin.top],
        [viewBoxWidth - margin.right, viewBoxHeight - margin.bottom - 6],
      ])
      .on('start', brushstart) // Make sure don't pass surrounding brushes
      .on('brush', brushed) // Make sure don't pass surrounding brushes
      .on('end', brushend); // Keep track of what brushes is surrounding

    setBrushes((brushes) => [...brushes, { id: brushes.length, brush }]);
  };

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      style={{
        height: '100%',
        marginRight: '0px',
        marginLeft: '0px',
      }}
    >
      <g className="brush-area" ref={brushesContainer} />
      <g className="x-axis-stops-labels" />
      <g className="x-axis" />
      <g className="x-axis-stops" />
    </svg>
  );
}

MarecoMultiRange.propTypes = {
  stops: PropTypes.array.isRequired,
  extensions: PropTypes.array.isRequired,
  setExtensions: PropTypes.func.isRequired,
};
