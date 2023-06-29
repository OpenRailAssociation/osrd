import React from 'react';
import PropTypes from 'prop-types';
import { Source, LayerProps } from 'react-map-gl/maplibre';

import mapStyleJson from 'assets/mapstyles/OSMStyle.json';
import mapStyleDarkJson from 'assets/mapstyles/OSMDarkStyle.json';
import mapStyleBluePrintJson from 'assets/mapstyles/OSMBluePrintStyle.json';
import { OSM_URL } from 'common/Map/const';

import OrderedLayer, { OrderedLayerProps } from 'common/Map/Layers/OrderedLayer';

interface OSMProps {
  mapStyle: string;
  layerOrder?: number;
}

export function getMapStyle(mapStyle: string): LayerProps[] {
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

export function genLayerProps(
  mapStyle: string,
  layerOrder?: number
): (OrderedLayerProps & { key?: string })[] {
  const osmStyle = getMapStyle(mapStyle);
  return osmStyle.map((layer) => ({
    ...layer,
    key: layer.id,
    id: `osm/${layer.id}`,
    layerOrder,
  }));
}

export function genLayers(mapStyle: string, layerOrder?: number) {
  return genLayerProps(mapStyle, layerOrder).map((props) => <OrderedLayer {...props} />);
}

function OSM(props: OSMProps) {
  const { mapStyle, layerOrder } = props;

  return (
    <Source id="osm" type="vector" url={OSM_URL}>
      {genLayers(mapStyle, layerOrder)}
    </Source>
  );
}

OSM.propTypes = {
  mapStyle: PropTypes.string.isRequired,
};

export default OSM;
