import React, { useEffect, useState } from 'react';
import { LayerProps, Source } from 'react-map-gl/maplibre';

import mapStyleBluePrintJson from 'assets/mapstyles/OSMBluePrintStyle.json';
import mapStyleDarkJson from 'assets/mapstyles/OSMDarkStyle.json';
import mapStyleMinimalJson from 'assets/mapstyles/OSMMinimalStyle.json';
import mapStyleJson from 'assets/mapstyles/OSMStyle.json';
import { OSM_URL } from 'common/Map/const';

import OrderedLayer, { OrderedLayerProps } from 'common/Map/Layers/OrderedLayer';

interface OSMProps {
  mapStyle: string;
  mapIsLoaded?: boolean;
  layerOrder?: number;
}

function getMapStyle(mapStyle: string): LayerProps[] {
  switch (mapStyle) {
    case 'empty':
      return [] as LayerProps[];
    case 'dark':
      return mapStyleDarkJson as LayerProps[];
    case 'blueprint':
      return mapStyleBluePrintJson as LayerProps[];
    case 'minimal':
      return mapStyleMinimalJson as LayerProps[];
    default:
      return mapStyleJson as LayerProps[];
  }
}

export function genOSMLayerProps(
  mapStyle: string,
  layerOrder?: number
): (OrderedLayerProps & { key?: string })[] {
  const osmStyle = getMapStyle(mapStyle);
  return osmStyle.map((layer) => ({
    ...layer,
    key: `${layer.id}-${mapStyle}`,
    id: `osm/${layer.id}`,
    layerOrder,
  }));
}

export function genOSMLayers(mapStyle: string, layerOrder?: number) {
  return genOSMLayerProps(mapStyle, layerOrder).map((props) => <OrderedLayer {...props} />);
}

function OSM({ mapStyle, layerOrder, mapIsLoaded }: OSMProps) {
  // Hack to full reload layers to avoid glitches
  // when switching map style (see #5777)
  const [reload, setReload] = useState(true);

  useEffect(() => setReload(true), [mapStyle, mapIsLoaded]);
  useEffect(() => {
    if (reload) setReload(false);
  }, [reload]);

  return (
    !reload && (
      <Source id="osm" type="vector" url={OSM_URL}>
        {genOSMLayers(mapStyle, layerOrder)}
      </Source>
    )
  );
}

export default OSM;
