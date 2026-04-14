import { type LayerProps } from 'react-map-gl/maplibre';

import { useMapContext } from '../useMapContext';
import OrderedLayer from './OrderedLayer';

type HillshadeProps = {
  layerOrder?: number;
  display?: boolean;
};

const hillshadeParams: LayerProps = {
  id: 'osm/hillshade',
  source: 'terrain',
  type: 'hillshade',
  paint: {},
};

const Hillshade = ({ layerOrder }: HillshadeProps) => {
  const { mapStyle, terrain3DExaggeration } = useMapContext();
  if (mapStyle !== 'normal' || !terrain3DExaggeration) {
    return null;
  }
  return <OrderedLayer {...hillshadeParams} layerOrder={layerOrder} />;
};

export default Hillshade;
