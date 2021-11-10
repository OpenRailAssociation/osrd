import React from 'react';
import { Source, Layer } from 'react-map-gl';
import PropTypes from 'prop-types';

export default function RenderItinerary(props) {
  const { geojsonPath } = props;
  return (
    <>
      <Source type="geojson" data={geojsonPath}>
        <Layer
          id="geojsonPath"
          type="line"
          paint={{
            'line-width': 3,
            'line-color': '#e05206',
          }}
        />
      </Source>
    </>
  );
}

RenderItinerary.propTypes = {
  geojsonPath: PropTypes.object.isRequired,
};
