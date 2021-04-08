import React from 'react';
import { Source, Layer } from 'react-map-gl';
import { useSelector } from 'react-redux';

export default function RenderItinerary() {
  const { geojson, origin, destination } = useSelector((state) => state.osrdconf);
  if (geojson !== undefined
    && origin !== undefined
    && destination !== undefined) {
    return (
      <Source type="geojson" data={geojson}>
        <Layer
          type="line"
          paint={{
            'line-width': 5,
            'line-color': 'rgba(210, 225, 0, 0.75)',
          }}
        />
      </Source>
    );
  }
  return '';
}
