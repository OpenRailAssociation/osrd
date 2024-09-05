import { Source, type LayerProps } from 'react-map-gl/maplibre';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import type { Theme } from 'types';

interface BackgroundProps {
  colors: Theme;
  layerOrder?: number;
}

function Background(props: BackgroundProps) {
  const { colors, layerOrder } = props;

  const backgroundParams: LayerProps = {
    id: 'osm/background',
    type: 'background',
    layout: {
      visibility: 'visible',
    },
    paint: {
      'background-color': colors.background.color,
    },
  };

  return (
    <Source
      id="platform"
      type="vector"
      url="https://osm.osrd.fr/data/v3.json"
      source-layer="transportation"
    >
      <OrderedLayer {...backgroundParams} layerOrder={layerOrder} />
    </Source>
  );
}

export default Background;
