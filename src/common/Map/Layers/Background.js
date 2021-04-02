import React from 'react';
import PropTypes from 'prop-types';
import { Source, Layer } from 'react-map-gl';

const Background = (props) => {
  const { colors } = props;

  const backgroundParams = {
    id: 'osm/background',
    type: 'background',
    layout: {
      visibility: 'visible',
    },
    paint: {
      'background-color': colors.background,
    },
  };

  return (
    <Source
      id="platform"
      type="vector"
      url="https://osm.osrd.fr/data/v3.json"
      source-layer="transportation"
    >
      <Layer {...backgroundParams} />
    </Source>
  );
};

Background.propTypes = {
  colors: PropTypes.object.isRequired,
};

export default Background;
