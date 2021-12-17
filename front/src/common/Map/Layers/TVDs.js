import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Source, Layer } from 'react-map-gl';
import { MAP_URL } from 'common/Map/const';

export default function TVDs(props) {
  const { layersSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { geomType, idHover } = props;

  const layerdef = {
    type: 'line',
    'source-layer': 'tvd_sections',
    minzoom: 6,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
    },
    paint: {
      'line-opacity': 0,
    },
  };

  return layersSettings.tvds ? (
    <Source
      id={`osrd_tvd_section_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/tvd_sections/mvt/${geomType}/?version=${infraID}`}
    >
      <Layer
        {...layerdef}
        id={`chartis/osrd_tvd_section/${geomType}`}
        beforeId={`chartis/tracks-${geomType}/main`}
      />
      {idHover ? (
        <Layer
          {...layerdef}
          paint={{
            'line-color': '#f00',
            'line-width': 4,
            'line-opacity': 1,
          }}
          filter={['==', 'id', idHover]}
          id={`chartis/osrd_tvd_section_visible/${geomType}`}
          beforeId={`chartis/tracks-${geomType}/main`}
        />
      ) : null}
    </Source>
  ) : null;
}

TVDs.propTypes = {
  idHover: PropTypes.number,
  geomType: PropTypes.string.isRequired,
};

TVDs.defaultProps = {
  idHover: undefined,
};
