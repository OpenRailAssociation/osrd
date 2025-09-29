import { useEffect, useState } from 'react';

import { get } from 'lodash';

import OrderedLayer, { type OrderedLayerProps } from 'common/Map/Layers/OrderedLayer';
import { getOSMStyle } from 'common/Map/theme';
import type { MapStyle } from 'reducers/commonMap/types';

type OSMProps = {
  mapIsLoaded?: boolean;
  layerOrder?: number;
  mapStyle: MapStyle;
  showOSM3dBuildings: boolean;
};

type FullLayerProps = OrderedLayerProps & { key?: string };
type ToggledLayers = {
  showOSM3dBuildings?: boolean;
};

const filters: Record<string, string> = {
  batiments_3d: 'showOSM3dBuildings',
  'building-3d': 'showOSM3dBuildings',
};

export function genOSMLayerProps(
  mapStyle: MapStyle,
  toggledLayers: ToggledLayers,
  layerOrder?: number
): FullLayerProps[] {
  const osmStyle = getOSMStyle(mapStyle);
  return osmStyle.reduce<FullLayerProps[]>((acc, layer) => {
    const isShown = get(toggledLayers, filters[layer.id || ''], true);
    if (!isShown) {
      return acc;
    }
    return [
      ...acc,
      {
        ...layer,
        id: `osm/${layer.id}`,
        layerOrder,
        source: 'osm',
      },
    ];
  }, []);
}

export function genOSMLayers(
  mapStyle: MapStyle,
  toggledLayers: ToggledLayers,
  layerOrder?: number
) {
  return genOSMLayerProps(mapStyle, toggledLayers, layerOrder).map((props) => (
    <OrderedLayer key={`${props.id}-${mapStyle}`} {...props} />
  ));
}

function OSM({ layerOrder, mapIsLoaded, mapStyle, showOSM3dBuildings }: OSMProps) {
  // Hack to full reload layers to avoid glitches
  // when switching map style (see #5777)
  const [reload, setReload] = useState(true);

  useEffect(() => setReload(true), [mapStyle, mapIsLoaded]);
  useEffect(() => {
    if (reload) setReload(false);
  }, [reload]);

  const toggledLayers = { showOSM3dBuildings };

  if (reload) return null;
  return <>{genOSMLayers(mapStyle, toggledLayers, layerOrder)}</>;
}

export default OSM;
