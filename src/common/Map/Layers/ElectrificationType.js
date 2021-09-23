import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Source, Layer } from 'react-map-gl';
import { MAP_URL } from 'common/Map/const';

export default function ElectrificationType(props) {
  const { layersSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { geomType, colors } = props;
  const electrificationParams = {
    type: 'line',
    'source-layer': 'osrd_electrification_type',
    minzoom: 5,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'line-join': 'miter',
    },
    paint: {
      'line-color': ['case',
        ['==', ['get', 'electrification_type'], '15000'], colors.powerline.color15000V1623,
        ['==', ['get', 'electrification_type'], '3000'], colors.powerline.color3000V,
        ['==', ['get', 'electrification_type'], '1500'], colors.powerline.color1500V,
        ['==', ['get', 'electrification_type'], '850'], colors.powerline.color850V,
        ['==', ['get', 'electrification_type'], '800'], colors.powerline.color800V,
        ['==', ['get', 'electrification_type'], '750'], colors.powerline.color750V,
        colors.powerline.color25000V,
      ],
      'line-width': 6,
      'line-offset': 0,
      'line-opacity': 1,
      'line-dasharray': [0.1, 0.3],
    },
  };

  const electrificationTextParams = {
    type: 'symbol',
    'source-layer': 'osrd_electrification_type',
    minzoom: 5,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Medium'],
      'symbol-placement': 'line-center',
      'text-field': '{electrification_type}V',
      'text-offset': [0, 1],
      'text-size': {
        stops: [[10, 9], [14, 10]],
      },
      'text-justify': 'left',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-anchor': 'center',
      'text-pitch-alignment': 'auto',
      'text-rotation-alignment': 'auto',
    },
    paint: {
      'text-color': ['case',
        ['==', ['get', 'electrification_type'], '15000'], colors.powerline.color15000V1623,
        ['==', ['get', 'electrification_type'], '3000'], colors.powerline.color3000V,
        ['==', ['get', 'electrification_type'], '1500'], colors.powerline.color1500V,
        ['==', ['get', 'electrification_type'], '850'], colors.powerline.color850V,
        ['==', ['get', 'electrification_type'], '800'], colors.powerline.color800V,
        ['==', ['get', 'electrification_type'], '750'], colors.powerline.color750V,
        colors.powerline.color25000V,
      ],
    },
  };

  return layersSettings.electrification && (
    <Source
      id={`osrd_electrification_type_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/osrd_electrification_type/mvt/${geomType}/?version=${infraID}`}
    >
      <Layer {...electrificationParams} id={`chartis/osrd_electrification_type/${geomType}`} />
      <Layer {...electrificationTextParams} id={`chartis/osrd_electrification_type_names/${geomType}`} />
    </Source>
  );
}

ElectrificationType.propTypes = {
  geomType: PropTypes.string.isRequired,
  colors: PropTypes.object.isRequired,
};
