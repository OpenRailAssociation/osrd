import { type LayerProps } from 'react-map-gl/maplibre';

import OrderedLayer from './OrderedLayer';
import { useMapContext } from '../useMapContext';

type HillshadeProps = {
  mapStyle: string;
  layerOrder?: number;
  display?: boolean;
};

const hillshadeParams: LayerProps = {
  id: 'osm/hillshade',
  source: 'terrain',
  type: 'hillshade',
  paint: {},
};

const Hillshade = ({ mapStyle, layerOrder }: HillshadeProps) => {
  const { terrain3DExaggeration } = useMapContext();
  if (mapStyle !== 'normal' || !terrain3DExaggeration) {
    return null;
  }
  return <OrderedLayer {...hillshadeParams} layerOrder={layerOrder} />;
};

export default Hillshade;
