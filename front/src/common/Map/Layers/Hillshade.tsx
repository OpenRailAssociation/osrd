import React from 'react';
import PropTypes from 'prop-types';
import { Source } from 'react-map-gl';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface HillshadeProps {
  mapStyle: string;
  layerOrder: number;
}

function Hillshade(props: HillshadeProps) {
  const { mapStyle, layerOrder } = props;

  const hillshadeParams = {
    id: 'hillshading',
    source: 'hillshade',
    type: 'hillshade',
  };

  return mapStyle !== 'normal' ? null : (
    <Source
      id="hillshade"
      type="raster-dem"
      url="https://osm.osrd.fr/data/hillshade.json"
      source-layer="transportation"
    >
      <OrderedLayer id="osm/hillshade" {...hillshadeParams} layerOrder={layerOrder} />
    </Source>
  );
}

Hillshade.propTypes = {
  mapStyle: PropTypes.string.isRequired,
};

export default Hillshade;
