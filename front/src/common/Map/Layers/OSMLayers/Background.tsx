import { type LayerProps } from 'react-map-gl/maplibre';

import type { Theme } from 'common/Map/theme';

import OrderedLayer from '../OrderedLayer';

type BackgroundProps = {
  colors: Theme;
  layerOrder?: number;
};

function Background(props: BackgroundProps) {
  const { colors, layerOrder } = props;

  const backgroundParams: LayerProps = {
    id: 'background',
    type: 'background',
    layout: {
      visibility: 'visible',
    },
    paint: {
      'background-color': colors.background.color,
    },
  };

  return <OrderedLayer {...backgroundParams} layerOrder={layerOrder} />;
}

export default Background;
