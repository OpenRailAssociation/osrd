import React from 'react';
import PropTypes from 'prop-types';
import {
  Source, Layer,
} from 'react-map-gl';

export default class Gares extends React.Component {
  static propTypes = {
    mapURL: PropTypes.string.isRequired,
    sourceLayer: PropTypes.string.isRequired,
    minzoom: PropTypes.number,
  }

  static defaultProps = {
    minzoom: 0,
  }

  config = () => {
    const { minzoom } = this.props;
    return {
      type: 'symbol',
      'source-layer': 'map_mat_gare',
      layout: {
        'text-field': '{RA_libelle}',
        'text-font': [
          'Roboto Condensed',
        ],
        'text-size': 16,
        'text-anchor': 'center',
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        visibility: 'visible',
      },
      paint: {
        'text-color': '#0088ce',
        'text-halo-width': 2,
        'text-halo-color': 'rgba(255,255,255,0.75)',
        'text-halo-blur': 1,
      },
      minzoom,
    };
  };

  render() {
    const { mapURL, sourceLayer } = this.props;
    return (
      <Source type="vector" url={`${mapURL}/map/layer_def/gaia/map_mat_gare/${sourceLayer}`}>
        <Layer {...this.config()} />
      </Source>
    );
  }
}
