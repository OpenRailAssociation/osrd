import React from 'react';
import { Source, Layer } from 'react-map-gl';
import PropTypes from 'prop-types';

export default function RenderItinerary(props) {
  const { geojson } = props;
  return (
    <Source type="geojson" data={geojson}>
      <Layer
        id="geojsonPath"
        type="line"
        paint={{
          'line-width': 2,
          'line-color': '#e05206',
        }}
      />
    </Source>
  );
}

RenderItinerary.propTypes = {
  geojson: PropTypes.object.isRequired,
};
