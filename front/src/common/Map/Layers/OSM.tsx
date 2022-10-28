import React from 'react';
import PropTypes from 'prop-types';
import { Source, LayerProps } from 'react-map-gl';

import mapStyleJson from 'assets/mapstyles/OSMStyle.json';
import mapStyleDarkJson from 'assets/mapstyles/OSMDarkStyle.json';
import mapStyleBluePrintJson from 'assets/mapstyles/OSMBluePrintStyle.json';
import { OSM_URL } from 'common/Map/const';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface OSMProps {
  mapStyle: string;
  layerOrder: number;
}

function OSM(props: OSMProps) {
  const { mapStyle, layerOrder } = props;

  function getMapStyle(): LayerProps[] {
    switch (mapStyle) {
      case 'empty':
        return [] as LayerProps[];
      case 'dark':
        return mapStyleDarkJson as LayerProps[];
      case 'blueprint':
        return mapStyleBluePrintJson as LayerProps[];
      default:
        return mapStyleJson as LayerProps[];
    }
  }

  const genLayers = () => {
    const osmStyle = getMapStyle();
    return osmStyle.map((layer) => {
      const layerProps = {
        ...layer,
        key: layer.id,
        id: `osm/${layer.id}`,
        layerOrder,
      };
      return <OrderedLayer {...layerProps} />;
    });
  };

  return (
    <Source id="osm" type="vector" url={OSM_URL}>
      {genLayers()}
    </Source>
  );
}

OSM.propTypes = {
  mapStyle: PropTypes.string.isRequired,
};

export default OSM;
