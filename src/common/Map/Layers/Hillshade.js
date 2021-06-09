import React from 'react';
import PropTypes from 'prop-types';
import { Source, Layer } from 'react-map-gl';

const Hillshade = (props) => {
  const { mapStyle } = props;

  const hillshadeParams = {
    id: 'hillshading',
    source: 'hillshade',
    type: 'hillshade',
  };

  return mapStyle !== 'normal' ? null : (
    <Source id="hillshade" type="raster-dem" url="https://osm.osrd.fr/data/hillshade.json" source-layer="transportation">
      <Layer id="osm/hillshade" {...hillshadeParams} />
    </Source>
  );
};

Hillshade.propTypes = {
  mapStyle: PropTypes.string.isRequired,
};

export default Hillshade;
