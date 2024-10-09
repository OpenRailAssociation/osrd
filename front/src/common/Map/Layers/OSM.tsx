import { useEffect, useState } from 'react';

import { get } from 'lodash';
import { type LayerProps, Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import mapStyleBluePrintJson from 'assets/mapstyles/OSMBluePrintStyle.json';
import mapStyleDarkJson from 'assets/mapstyles/OSMDarkStyle.json';
import mapStyleMinimalJson from 'assets/mapstyles/OSMMinimalStyle.json';
import mapStyleJson from 'assets/mapstyles/OSMStyle.json';
import { OSM_URL } from 'common/Map/const';
import OrderedLayer, { type OrderedLayerProps } from 'common/Map/Layers/OrderedLayer';
import { getShowOSM3dBuildings } from 'reducers/map/selectors';

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

type FullLayerProps = OrderedLayerProps & { key?: string };
type ToggledLayers = {
  showOSM3dBuildings?: boolean;
};

const filters: Record<string, string> = {
  batiments_3d: 'showOSM3dBuildings',
  'building-3d': 'showOSM3dBuildings',
};

export function genOSMLayerProps(
  mapStyle: string,
  toggledLayers: ToggledLayers,
  layerOrder?: number
): FullLayerProps[] {
  const osmStyle = getMapStyle(mapStyle);
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
      },
    ];
  }, []);
}

export function genOSMLayers(mapStyle: string, toggledLayers: ToggledLayers, layerOrder?: number) {
  return genOSMLayerProps(mapStyle, toggledLayers, layerOrder).map((props) => (
    <OrderedLayer key={`${props.id}-${mapStyle}`} {...props} />
  ));
}

function OSM({ mapStyle, layerOrder, mapIsLoaded }: OSMProps) {
  // Hack to full reload layers to avoid glitches
  // when switching map style (see #5777)
  const [reload, setReload] = useState(true);
  const showOSM3dBuildings = useSelector(getShowOSM3dBuildings);

  useEffect(() => setReload(true), [mapStyle, mapIsLoaded]);
  useEffect(() => {
    if (reload) setReload(false);
  }, [reload]);

  const toggledLayers = { showOSM3dBuildings };

  if (reload) return null;
  return (
    <Source id="osm" type="vector" url={OSM_URL}>
      {genOSMLayers(mapStyle, toggledLayers, layerOrder)}
    </Source>
  );
}

export default OSM;
