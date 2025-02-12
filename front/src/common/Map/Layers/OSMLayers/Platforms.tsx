import { type LayerProps } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import type { RootState } from 'reducers';
import type { Theme } from 'types';

interface PlatformsProps {
  colors: Theme;
  layerOrder?: number;
}

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
  const { layersSettings } = useSelector((state: RootState) => state.map);

  if (!layersSettings.platforms) return null;
  return <Platforms {...props} />;
}

export default PlatformsState;
