import React from 'react';
import PropTypes from 'prop-types';
import { Source, Layer } from 'react-map-gl';

export default function MapTrainMarker(props) {
  const {
    text, codenbengin, lon, lat, angle,
  } = props;

  const mapTrainMarkerLayer = {
    id: 'mapTrainMarkerLayer',
    type: 'symbol',
    layout: {
      'text-field': text,
      'text-font': [
        'Roboto Condensed',
      ],
      'text-size': 10,
      'icon-image': codenbengin,
      'icon-size': 0.3,
      'icon-anchor': 'center',
      'text-offset': [0, -2],
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'text-rotation-alignment': 'viewport',
      'icon-rotate': angle + 90,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#555',
      'text-halo-width': 3,
      'text-halo-color': 'rgba(255,255,255,0.75)',
      'text-halo-blur': 0,
    },
  };

  const pointData = {
    type: 'Point',
    coordinates: [lon, lat],
  };

  return (
    <Source type="geojson" data={pointData}>
      <Layer {...mapTrainMarkerLayer} />
    </Source>
  );
}

MapTrainMarker.propTypes = {
  codenbengin: PropTypes.string.isRequired,
  text: PropTypes.string,
  lon: PropTypes.number.isRequired,
  lat: PropTypes.number.isRequired,
  angle: PropTypes.number.isRequired,
};

MapTrainMarker.defaultProps = {
  text: '',
};
