import React from 'react';
import PropTypes from 'prop-types';
import {
  Source, Layer,
} from 'react-map-gl';

const layoutStation = {
  type: 'symbol',
  minZoom: 7,
  layout: {
    'text-field': '{libelle}',
    'text-font': [
      'Roboto Condensed',
    ],
    'text-size': 12,
    'text-offset': [0, 2],
    'text-anchor': 'center',
    'text-allow-overlap': false,
    visibility: 'visible',
  },
  paint: {
    'text-color': '#333',
    'text-halo-width': 2,
    'text-halo-color': 'rgba(255,255,255,0.75)',
    'text-halo-blur': 1,
  },
};

const layoutStationNumber = {
  type: 'symbol',
  layout: {
    'text-field': ['concat',
      ['/', ['get', 'frequentationPCTm2'], 100],
      'p/m²'],
    'text-font': [
      'Roboto Bold',
    ],
    'text-size': 12,
    'text-anchor': 'center',
    'text-allow-overlap': true,
    visibility: 'visible',
  },
  paint: {
    'text-color': '#333',
    'text-halo-width': 2,
    'text-halo-color': 'rgba(255,255,255,0.75)',
    'text-halo-blur': 1,
    'text-opacity': [
      'case',
      ['==', ['get', 'active'], 0], 0,
      ['==', ['+', ['get', 'frequentationPCT'], ['get', 'frequentationPCTm2'], 0], 0], 0,
      1,
    ],
  },
};

const circleClusters = {
  type: 'circle',
  filter: ['==', ['get', 'active'], 1],
  paint: {
    'circle-color':
      ['step',
        ['get', 'frequentationPCTm2'],
        '#82be00',
        60,
        '#d2e100',
        70,
        '#ffb612',
        80,
        '#e05206',
        90,
        '#cd0037',
        100,
        '#a1006b',
      ],
    'circle-opacity': 0.6,
    'circle-radius': 15,
  },
};

const circleClustersOff = {
  type: 'circle',
  filter: ['==', ['get', 'active'], 0],
  paint: {
    'circle-color': '#777',
    'circle-opacity': 0.6,
    'circle-radius': 15,
  },
};

export default class SmartFlow extends React.Component {
  static propTypes = {
    geoJson: PropTypes.object.isRequired,
  }

  render() {
    const { geoJson } = this.props;
    return (
      <Source type="geojson" data={geoJson}>
        <Layer {...circleClusters} id="circleLayer" />
        <Layer {...circleClustersOff} />
        <Layer {...layoutStationNumber} />
        <Layer {...layoutStation} />
      </Source>
    );
  }
}
