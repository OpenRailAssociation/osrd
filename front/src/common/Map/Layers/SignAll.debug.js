import React from 'react';
import PropTypes from 'prop-types';
import {
  Source, Layer,
} from 'react-map-gl';

const signal = {
  type: 'symbol',
  'source-layer': 'signal',
  layout: {
    'text-field': '{position}',
    'text-font': [
      'Roboto Condensed',
    ],
    'text-size': 14,
    'text-allow-overlap': true,
    'text-ignore-placement': true,
  },
  paint: {
    'text-color': '#e05206',
    'text-halo-width': 2,
    'text-halo-color': 'rgba(255,255,255,0.75)',
    'text-halo-blur': 1,
  },
};

export default class Signals extends React.Component {
  static propTypes = {
    mapURL: PropTypes.string.isRequired,
    sourceLayer: PropTypes.string.isRequired,
  }

  render() {
    const { mapURL, sourceLayer } = this.props;
    return (
      <Source type="vector" url={`${mapURL}/map/layer_def/gaia/signal/${sourceLayer}`}>
        <Layer {...signal} />
      </Source>
    );
  }
}
