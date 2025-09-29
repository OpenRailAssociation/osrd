import { type LayerProps } from 'react-map-gl/maplibre';

import type { Theme } from 'common/Map/theme';

import OrderedLayer from '../OrderedLayer';

type TracksOSMProps = {
  colors: Theme;
  layerOrder: number;
  showOSMtracksections: boolean;
};

function TracksOSM({ colors, layerOrder, showOSMtracksections }: TracksOSMProps) {
  const railwayMinor: LayerProps = {
    id: 'railwayMinor',
    type: 'line',
    source: 'osm',
    'source-layer': 'transportation',
    filter: ['all', ['==', ['get', 'class'], 'rail'], ['==', ['get', 'service'], 'yard']],
    layout: {
      visibility: 'visible',
    },
    paint: {
      'line-color': colors.tracksosm.minor,
    },
  };

  const railwayMajor: LayerProps = {
    id: 'railwayMajor',
    type: 'line',
    source: 'osm',
    'source-layer': 'transportation',
    filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'service'], 'yard']],
    layout: {
      visibility: 'visible',
    },
    paint: {
      'line-color': colors.tracksosm.major,
      'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1, 17, 3],
    },
  };

  if (!showOSMtracksections) return null;
  return (
    <>
      <OrderedLayer {...railwayMinor} layerOrder={layerOrder} />
      <OrderedLayer {...railwayMajor} layerOrder={layerOrder} />
    </>
  );
}

export default TracksOSM;
