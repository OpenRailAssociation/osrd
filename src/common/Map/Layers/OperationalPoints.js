import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Source, Layer } from 'react-map-gl';
import { MAP_URL } from 'common/Map/const';

export default function OperationalPoints(props) {
  const { layersSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { geomType } = props;
  const layerdef = {
    type: 'circle',
    minzoom: 9,
    'source-layer': 'osrd_operational_point',
    paint: {
      'circle-color': '#f00',
      'circle-radius': 3,
    },
  };

  return layersSettings.operationalpoints && (
    <Source
      id={`osrd_operational_point_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/osrd_operational_point/mvt/${geomType}/?version=${infraID}`}
    >
      <Layer {...layerdef} id={`chartis/osrd_operational_point/${geomType}`} />
    </Source>
  );
}

OperationalPoints.propTypes = {
  geomType: PropTypes.string.isRequired,
};
