import { type LayerProps } from 'react-map-gl/maplibre';

import type { Theme } from 'common/Map/theme';
import { useMapSettings } from 'reducers/commonMap';

import OrderedLayer from '../OrderedLayer';

type PlatformsProps = {
  colors: Theme;
  layerOrder?: number;
};

export function Platforms(props: PlatformsProps) {
  const { colors, layerOrder } = props;

  const platformsParams: LayerProps = {
    type: 'fill',
    source: 'osm',
    'source-layer': 'transportation',
    filter: ['all', ['==', ['get', 'class'], 'path'], ['==', ['get', 'subclass'], 'platform']],
    paint: {
      'fill-color': colors.platform.fill,
    },
  };

  return <OrderedLayer {...platformsParams} layerOrder={layerOrder} />;
}

function PlatformsState(props: PlatformsProps) {
  const { layersSettings } = useMapSettings();

  if (!layersSettings.platforms) return null;
  return <Platforms {...props} />;
}

export default PlatformsState;
