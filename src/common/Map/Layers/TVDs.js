import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Source, Layer } from 'react-map-gl';
import { MAP_URL } from 'common/Map/const';

export default function TVDs(props) {
  const { layersSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { geomType } = props;

  const layerdef = {
    type: 'line',
    'source-layer': 'osrd_tvd_section',
    minzoom: 6,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'line-cap': 'round',
      'line-join': 'miter',
    },
    paint: {
      'line-color': '#f00',
      'line-width': 4,
      'line-offset': 0,
      'line-opacity': 1,
    },
  };

  return layersSettings.tvds ? (
    <Source
      id={`osrd_tvd_section_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/osrd_tvd_section/mvt/${geomType}/?version=${infraID}`}
    >
      <Layer
        {...layerdef}
        id={`chartis/osrd_tvd_section/${geomType}`}
        beforeId={`chartis/tracks-${geomType}/main`}
      />
    </Source>
  ) : null;
}

TVDs.propTypes = {
  geomType: PropTypes.string.isRequired,
};
